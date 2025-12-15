const CONFIG = {
    objects: {
        house: {
            icon: '🏠',
            label: 'Будинок',
            color: '#FF6B6B',
            size: 40,
        },
        road: {
            icon: '🛣️',
            label: 'Дорога',
            color: '#4A90E2',
            size: 50,
        },
        school: {
            icon: '🏫',
            label: 'Школа',
            color: '#F5A623',
            size: 45,
        },
        hospital: {
            icon: '🏥',
            label: 'Лікарня',
            color: '#D84449',
            size: 45,
        },
        park: {
            icon: '🌲',
            label: 'Парк',
            color: '#52C41A',
            size: 50,
        },
    },
    storage: {
        key: 'cityMapConstructor_data',
        historyKey: 'cityMapConstructor_history',
    },
};

class CityMapConstructor {
    constructor() {
        this.objects = [];
        this.history = [];
        this.selectedTool = null;
        this.selectedObject = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.filters = {
            house: true,
            road: true,
            school: true,
            hospital: true,
            park: true,
        };

        this.canvas = document.getElementById('canvas');
        this.toolButtons = document.querySelectorAll('.tool-btn');
        this.filterCheckboxes = document.querySelectorAll('.filter-checkbox');
        this.saveBtn = document.getElementById('saveBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.modeIndicator = document.getElementById('modeIndicator');
        this.notification = document.getElementById('notification');
        this.deleteModal = document.getElementById('deleteModal');
        this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        this.notificationText = document.getElementById('notificationText');

        this.statsElements = {
            totalObjects: document.getElementById('totalObjects'),
            houseCount: document.getElementById('houseCount'),
            roadCount: document.getElementById('roadCount'),
            schoolCount: document.getElementById('schoolCount'),
            hospitalCount: document.getElementById('hospitalCount'),
            parkCount: document.getElementById('parkCount'),
        };

        this.init();
    }

    init() {
        this.loadFromStorage();
        this.attachEventListeners();
        this.setupCanvasSize();
        this.render();
        window.addEventListener('resize', () => this.setupCanvasSize());
    }

    attachEventListeners() {
        this.toolButtons.forEach((btn) => {
            btn.addEventListener('click', () => this.selectTool(btn));
        });

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseUp());

        this.filterCheckboxes.forEach((checkbox) => {
            checkbox.addEventListener('change', (e) => this.toggleFilter(e));
        });

        this.saveBtn.addEventListener('click', () => this.saveToStorage());
        this.undoBtn.addEventListener('click', () => this.undo());
        this.clearBtn.addEventListener('click', () => this.confirmClear());

        this.cancelDeleteBtn.addEventListener('click', () =>
            this.closeDeleteModal()
        );
        this.confirmDeleteBtn.addEventListener('click', () =>
            this.confirmDelete()
        );

        this.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) {
                this.closeDeleteModal();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'z') {
                this.undo();
            }
            if (e.key === 'Escape') {
                this.deselectTool();
                this.closeDeleteModal();
            }
            if (e.key === 'Delete' && this.selectedObject) {
                this.showDeleteModal();
            }
        });
    }

    setupCanvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.setAttribute('width', rect.width);
        this.canvas.setAttribute('height', rect.height);
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
    }

    selectTool(btn) {
        const toolType = btn.dataset.type;

        this.toolButtons.forEach((b) => b.classList.remove('active'));

        if (this.selectedTool === toolType) {
            this.selectedTool = null;
            this.updateModeIndicator();
            this.canvas.classList.remove('active');
            return;
        }

        this.selectedTool = toolType;
        btn.classList.add('active');
        this.updateModeIndicator();
        this.canvas.classList.add('active');
    }

    deselectTool() {
        this.toolButtons.forEach((btn) => btn.classList.remove('active'));
        this.selectedTool = null;
        this.updateModeIndicator();
        this.canvas.classList.remove('active');
    }

    updateModeIndicator() {
        const modeText = this.canvas.querySelector('.mode-text') ||
            this.modeIndicator.querySelector('.mode-text');
        if (this.selectedTool) {
            const label = CONFIG.objects[this.selectedTool].label;
            this.modeIndicator.innerHTML =
                `<span class="mode-text">Додавання: <strong>${label}</strong></span>`;
            this.modeIndicator.classList.add('active');
        } else {
            this.modeIndicator.innerHTML =
                '<span class="mode-text">Готово до додавання</span>';
            this.modeIndicator.classList.remove('active');
        }
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clickedObject = this.getObjectAtPoint(x, y);

        if (clickedObject) {
            this.selectObject(clickedObject, e);
            return;
        }

        if (this.selectedTool) {
            this.addObject(this.selectedTool, x, y);
            this.deselectTool();
        }
    }

    handleCanvasMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.isDragging && this.selectedObject) {
            this.selectedObject.x =
                Math.max(
                    this.selectedObject.size / 2,
                    Math.min(x - this.dragOffset.x, this.canvasWidth - this.selectedObject.size / 2)
                );
            this.selectedObject.y =
                Math.max(
                    this.selectedObject.size / 2,
                    Math.min(y - this.dragOffset.y, this.canvasHeight - this.selectedObject.size / 2)
                );
            this.render();
            return;
        }

        const hoverObject = this.getObjectAtPoint(x, y);
        if (hoverObject && !this.selectedTool) {
            this.canvas.style.cursor = 'grab';
        } else if (this.selectedTool) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    handleCanvasMouseUp() {
        this.isDragging = false;
        if (this.selectedObject) {
            this.selectedObject = null;
            this.render();
        }
    }

    addObject(type, x, y) {
        const config = CONFIG.objects[type];
        const newObject = {
            id: Date.now(),
            type,
            x,
            y,
            size: config.size,
            label: config.label,
            color: config.color,
        };

        this.saveHistory();
        this.objects.push(newObject);
        this.updateStats();
        this.render();
    }

    selectObject(obj, e) {
        e.preventDefault();
        this.selectedObject = obj;
        this.isDragging = true;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        this.dragOffset = {
            x: mouseX - obj.x,
            y: mouseY - obj.y,
        };
        this.render();
    }

    showDeleteModal() {
        this.deleteModal.classList.add('show');
    }

    closeDeleteModal() {
        this.deleteModal.classList.remove('show');
    }

    confirmDelete() {
        if (this.selectedObject) {
            this.saveHistory();
            this.objects = this.objects.filter(
                (obj) => obj.id !== this.selectedObject.id
            );
            this.selectedObject = null;
            this.updateStats();
            this.render();
            this.closeDeleteModal();
            this.showNotification('Об\'єкт видалено');
        }
    }

    toggleFilter(e) {
        const filterType = e.target.dataset.filter;
        this.filters[filterType] = e.target.checked;
        this.render();
    }

    saveHistory() {
        this.history.push(JSON.stringify(this.objects));
        if (this.history.length > 50) {
            this.history.shift();
        }
        this.updateUndoButton();
    }

    undo() {
        if (this.history.length === 0) return;

        const previousState = this.history.pop();
        this.objects = JSON.parse(previousState);
        this.selectedObject = null;
        this.updateStats();
        this.updateUndoButton();
        this.render();
        this.showNotification('Дія скасована');
    }

    updateUndoButton() {
        this.undoBtn.disabled = this.history.length === 0;
    }

    confirmClear() {
        if (this.objects.length === 0) {
            this.showNotification('Карта уже порожня');
            return;
        }
        if (confirm('Ви впевнені, що хочете очистити всю карту?')) {
            this.saveHistory();
            this.objects = [];
            this.selectedObject = null;
            this.updateStats();
            this.render();
            this.showNotification('Карта очищена');
        }
    }

    saveToStorage() {
        localStorage.setItem(CONFIG.storage.key, JSON.stringify(this.objects));
        this.showNotification('План успішно збережено!');
    }

    loadFromStorage() {
        const stored = localStorage.getItem(CONFIG.storage.key);
        if (stored) {
            try {
                this.objects = JSON.parse(stored);
                this.updateStats();
            } catch (e) {
                console.error('Помилка при завантаженні даних:', e);
            }
        }
    }

    updateStats() {
        const counts = {
            house: 0,
            road: 0,
            school: 0,
            hospital: 0,
            park: 0,
        };

        this.objects.forEach((obj) => {
            counts[obj.type]++;
        });

        const total = this.objects.length;
        this.statsElements.totalObjects.textContent = total;
        this.statsElements.houseCount.textContent = counts.house;
        this.statsElements.roadCount.textContent = counts.road;
        this.statsElements.schoolCount.textContent = counts.school;
        this.statsElements.hospitalCount.textContent = counts.hospital;
        this.statsElements.parkCount.textContent = counts.park;
    }

    render() {
        while (this.canvas.firstChild) {
            this.canvas.removeChild(this.canvas.firstChild);
        }

        this.objects.forEach((obj) => {
            if (!this.filters[obj.type]) return;

            const element = this.createObjectElement(obj);
            this.canvas.appendChild(element);

            element.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this.selectedObject = obj;
                this.showDeleteModal();
            });

            element.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.selectedObject = obj;
                this.showDeleteModal();
            });
        });
    }

    createObjectElement(obj) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'map-object');
        if (obj === this.selectedObject) {
            g.classList.add('selected');
        }
        if (this.isDragging && obj === this.selectedObject) {
            g.classList.add('dragging');
        }

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', obj.x);
        circle.setAttribute('cy', obj.y);
        circle.setAttribute('r', obj.size / 2);
        circle.setAttribute('class', `object-${obj.type}`);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', obj.x);
        text.setAttribute('y', obj.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-size', '20');
        text.setAttribute('fill', 'white');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('font-weight', 'bold');
        text.textContent = CONFIG.objects[obj.type].icon;

        g.appendChild(circle);
        g.appendChild(text);

        return g;
    }

    getObjectAtPoint(x, y) {
        for (let i = this.objects.length - 1; i >= 0; i--) {
            const obj = this.objects[i];
            if (!this.filters[obj.type]) continue;

            const dist = Math.sqrt(
                Math.pow(obj.x - x, 2) + Math.pow(obj.y - y, 2)
            );

            if (dist <= obj.size / 2 + 5) {
                return obj;
            }
        }
        return null;
    }

    showNotification(message) {
        this.notificationText.textContent = message;
        this.notification.classList.add('show');
        setTimeout(() => {
            this.notification.classList.remove('show');
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CityMapConstructor();
});
