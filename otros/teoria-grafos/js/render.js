/**
 * render.js
 * 
 * Lógica de renderizado en Canvas y manejo de eventos de ratón para interacción.
 */

class GraphRenderer {
    constructor(canvas, grafo, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.grafo = grafo;
        this.isReadOnly = options.isReadOnly || false;
        
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Estado de interacción
        this.draggedNode = null;
        this.hoveredNode = null;
        this.hoveredEdge = null;
        this.creatingEdgeFrom = null; // Nodo desde el cual se arrastra para crear una arista
        this.mousePos = { x: 0, y: 0 };
        
        // Configuraciones visuales base
        this.styles = {
            nodeRadius: 18,
            nodeColor: '#1e293b', // panel dark
            nodeBorder: '#6366f1', // primary
            nodeBorderWidth: 2,
            nodeText: '#f8fafc',
            edgeColor: 'rgba(148, 163, 184, 0.5)', // text-muted con opacidad
            edgeWidth: 3,
            hoverGlow: 'rgba(99, 102, 241, 0.5)',
            createEdgeColor: 'rgba(6, 182, 212, 0.8)' // secondary (cyan)
        };

        // Hooks para extender la visualización desde los modos
        this.nodeRenderHook = null; 
        this.edgeRenderHook = null;
        
        // Listeners
        this.bindEvents();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Bucle de animación
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    resize() {
        const parent = this.canvas.parentElement;
        if(parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
        }
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mousePos = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };

            if (this.draggedNode && !this.creatingEdgeFrom) {
                this.draggedNode.x = this.mousePos.x;
                this.draggedNode.y = this.mousePos.y;
            }

            this.updateHoverState();
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isReadOnly) return;
            
            if (e.button === 0) { // Clic izquierdo
                const activeToolElem = document.querySelector('input[name="sandbox-tool"]:checked');
                const activeTool = activeToolElem ? activeToolElem.value : 'move';

                if (this.hoveredNode) {
                    if (activeTool === 'delete') {
                        this.grafo.removeNodo(this.hoveredNode.id);
                        this.hoveredNode = null;
                        // Despachar evento para actualizar stats en main.js
                        this.canvas.dispatchEvent(new Event('graph-changed'));
                    } else if (e.shiftKey || activeTool === 'edge') {
                        this.creatingEdgeFrom = this.hoveredNode;
                    } else {
                        this.draggedNode = this.hoveredNode;
                    }
                } else if (this.hoveredEdge) {
                    if (activeTool === 'delete') {
                        this.grafo.removeArista(this.hoveredEdge.id);
                        this.hoveredEdge = null;
                        this.canvas.dispatchEvent(new Event('graph-changed'));
                    }
                } else if (!this.hoveredEdge) {
                    if (activeTool !== 'delete') {
                        // Clic en espacio vacío: crear nodo
                        this.grafo.addNodo(this.mousePos.x, this.mousePos.y);
                        this.updateHoverState();
                        this.canvas.dispatchEvent(new Event('graph-changed'));
                    }
                }
            } else if (e.button === 2) { // Clic derecho
                if (this.hoveredNode) {
                    this.grafo.removeNodo(this.hoveredNode.id);
                    this.hoveredNode = null;
                    this.canvas.dispatchEvent(new Event('graph-changed'));
                } else if (this.hoveredEdge) {
                    this.grafo.removeArista(this.hoveredEdge.id);
                    this.hoveredEdge = null;
                    this.canvas.dispatchEvent(new Event('graph-changed'));
                }
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isReadOnly) return;
            
            if (e.button === 0) {
                if (this.creatingEdgeFrom) {
                    if (this.hoveredNode && this.hoveredNode !== this.creatingEdgeFrom) {
                        this.grafo.addArista(this.creatingEdgeFrom.id, this.hoveredNode.id);
                    }
                }
                this.draggedNode = null;
                this.creatingEdgeFrom = null;
            }
        });

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    updateHoverState() {
        // Encontrar nodo hovereado
        this.hoveredNode = null;
        const nodos = this.grafo.getNodos();
        for (let i = nodos.length - 1; i >= 0; i--) {
            const n = nodos[i];
            const dist = Math.hypot(n.x - this.mousePos.x, n.y - this.mousePos.y);
            if (dist <= this.styles.nodeRadius) {
                this.hoveredNode = n;
                break;
            }
        }

        // Si no hay nodo, buscar arista
        this.hoveredEdge = null;
        if (!this.hoveredNode) {
            const aristas = this.grafo.getAristas();
            for (let a of aristas) {
                const u = this.grafo.nodos.get(a.u);
                const v = this.grafo.nodos.get(a.v);
                
                // Distancia punto a segmento
                const l2 = Math.pow(u.x - v.x, 2) + Math.pow(u.y - v.y, 2);
                let dist = 0;
                if (l2 === 0) {
                    dist = Math.hypot(this.mousePos.x - u.x, this.mousePos.y - u.y);
                } else {
                    let t = ((this.mousePos.x - u.x) * (v.x - u.x) + (this.mousePos.y - u.y) * (v.y - u.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    const projX = u.x + t * (v.x - u.x);
                    const projY = u.y + t * (v.y - u.y);
                    dist = Math.hypot(this.mousePos.x - projX, this.mousePos.y - projY);
                }

                if (dist <= this.styles.edgeWidth + 5) { // Tolerancia para hacer clic
                    this.hoveredEdge = a;
                    break;
                }
            }
        }
        
        // Actualizar cursor
        if (this.hoveredNode || this.hoveredEdge) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const aristas = this.grafo.getAristas();
        const nodos = this.grafo.getNodos();

        const edgeLabelsToDraw = [];

        // Render aristas
        aristas.forEach(arista => {
            const u = this.grafo.nodos.get(arista.u);
            const v = this.grafo.nodos.get(arista.v);
            
            this.ctx.beginPath();
            this.ctx.moveTo(u.x, u.y);
            this.ctx.lineTo(v.x, v.y);
            
            let color = this.styles.edgeColor;
            let width = this.styles.edgeWidth;
            
            if (this.hoveredEdge === arista) {
                color = '#f8fafc'; // Resaltar
                width += 2;
            }
            
            // Permitir que un hook modifique el estilo
            if (this.edgeRenderHook) {
                const customStyle = this.edgeRenderHook(arista, {color, width});
                color = customStyle.color || color;
                width = customStyle.width || width;
                
                if (customStyle.label) {
                    edgeLabelsToDraw.push({arista, label: customStyle.label, customStyle});
                }
            }

            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = width;
            this.ctx.stroke();
        });

        // Dibujar etiquetas de aristas encima de todas las líneas
        edgeLabelsToDraw.forEach(({arista, label, customStyle}) => {
            const u = this.grafo.nodos.get(arista.u);
            const v = this.grafo.nodos.get(arista.v);
            const midX = (u.x + v.x) / 2;
            const midY = (u.y + v.y) / 2;

            this.ctx.font = customStyle.font || 'bold 12px Inter';
            const textMetrics = this.ctx.measureText(label);
            const padding = 2;
            
            if (customStyle.labelBgColor) {
                this.ctx.fillStyle = customStyle.labelBgColor;
                this.ctx.fillRect(midX - textMetrics.width/2 - padding, midY - 10 - 6 - padding, textMetrics.width + padding*2, 12 + padding*2);
            }
            
            this.ctx.fillStyle = customStyle.labelColor || '#f8fafc';
            this.ctx.fillText(label, midX, midY - 10);
        });

        // Render arista en creación
        if (this.creatingEdgeFrom) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.creatingEdgeFrom.x, this.creatingEdgeFrom.y);
            this.ctx.lineTo(this.mousePos.x, this.mousePos.y);
            this.ctx.strokeStyle = this.styles.createEdgeColor;
            this.ctx.lineWidth = this.styles.edgeWidth;
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // Render nodos
        nodos.forEach(nodo => {
            let radius = this.styles.nodeRadius;
            let color = this.styles.nodeColor;
            let borderColor = this.styles.nodeBorder;
            let borderWidth = this.styles.nodeBorderWidth;
            let text = nodo.label;
            
            if (this.hoveredNode === nodo || this.draggedNode === nodo) {
                borderWidth += 2;
                // Efecto de brillo (Glow)
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = this.styles.hoverGlow;
            }

            // Hook personalizado para el modo activo (ej. cambiar tamaño o color según grado)
            if (this.nodeRenderHook) {
                const customStyle = this.nodeRenderHook(nodo, {radius, color, borderColor, borderWidth, text});
                radius = customStyle.radius || radius;
                color = customStyle.color || color;
                borderColor = customStyle.borderColor || borderColor;
                borderWidth = customStyle.borderWidth || borderWidth;
                text = customStyle.text !== undefined ? customStyle.text : text;
            }

            this.ctx.beginPath();
            this.ctx.arc(nodo.x, nodo.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = borderWidth;
            this.ctx.stroke();
            
            // Reset shadow
            this.ctx.shadowBlur = 0;

            // Render texto
            this.ctx.fillStyle = this.styles.nodeText;
            this.ctx.font = '600 14px Inter, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, nodo.x, nodo.y);
        });

        requestAnimationFrame(this.render);
    }
}
