/**
 * modos.js
 * 
 * Controla los diferentes modos de visualización en la sección "Explora" (Sandbox).
 * Utiliza los hooks de render.js para modificar la apariencia visual del grafo.
 */

class SandboxManager {
    constructor(grafo, renderer) {
        this.grafo = grafo;
        this.renderer = renderer;
        this.currentMode = 'normal';
        
        // Estado para el modo camino
        this.pathSelection = []; // Nodos seleccionados
        this.pathResult = null; // Aristas a resaltar
        
        // Estado para conectividad
        this.componentColors = {}; // idNodo -> color

        this.setupHooks();
        this.updateStats();
    }

    setMode(mode) {
        this.currentMode = mode;
        this.pathSelection = [];
        this.pathResult = null;
        
        if (mode === 'conectividad') {
            this.recalculateComponents();
        }

        const msgBox = document.getElementById('sandbox-overlay-msg');
        if (mode === 'camino') {
            msgBox.textContent = 'Haz clic en dos nodos para ver el camino más corto.';
            msgBox.classList.remove('hidden');
        } else if (mode === 'ciclos') {
            const hasCycles = this.grafo.hasCiclos();
            const isTree = this.grafo.isArbol();
            if (isTree) {
                msgBox.textContent = '¡Es un Árbol! (Conexo y sin ciclos)';
                msgBox.style.color = '#10b981'; // Emerald
            } else if (hasCycles) {
                msgBox.textContent = 'Se detectaron ciclos en el grafo.';
                msgBox.style.color = '#ef4444'; // Red
            } else {
                msgBox.textContent = 'No hay ciclos, pero no está conectado (Bosque).';
                msgBox.style.color = '#f59e0b'; // Amber
            }
            msgBox.classList.remove('hidden');
        } else {
            msgBox.classList.add('hidden');
        }

        this.updateStats();
    }

    handleClick(nodo) {
        if (this.currentMode === 'camino' && nodo) {
            if (this.pathSelection.length === 2) {
                this.pathSelection = [];
                this.pathResult = null;
            }
            if (!this.pathSelection.includes(nodo)) {
                this.pathSelection.push(nodo);
                if (this.pathSelection.length === 2) {
                    this.calculateShortestPath(this.pathSelection[0], this.pathSelection[1]);
                }
            }
        }
    }

    recalculateComponents() {
        const componentes = this.grafo.getComponentesConexas();
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
        this.componentColors = {};
        
        componentes.forEach((comp, idx) => {
            const color = colors[idx % colors.length];
            comp.forEach(nodoId => {
                this.componentColors[nodoId] = color;
            });
        });
    }

    calculateShortestPath(start, end) {
        // BFS simple ya que los pesos son 1 en el sandbox
        const dist = new Map();
        const prev = new Map();
        const cola = [start.id];
        
        dist.set(start.id, 0);

        while (cola.length > 0) {
            const current = cola.shift();
            
            if (current === end.id) break;

            const adjs = this.grafo.adjList.get(current);
            for (const adj of adjs) {
                if (!dist.has(adj.node)) {
                    dist.set(adj.node, dist.get(current) + 1);
                    prev.set(adj.node, { node: current, edge: adj.edge });
                    cola.push(adj.node);
                }
            }
        }

        if (!prev.has(end.id)) {
            const msgBox = document.getElementById('sandbox-overlay-msg');
            msgBox.textContent = 'No hay camino entre estos nodos.';
            msgBox.style.color = '#ef4444';
            return;
        }

        this.pathResult = [];
        let curr = end.id;
        while (curr !== start.id) {
            const step = prev.get(curr);
            this.pathResult.push(step.edge);
            curr = step.node;
        }
    }

    setupHooks() {
        this.renderer.nodeRenderHook = (nodo, baseStyle) => {
            let style = { ...baseStyle };

            if (this.currentMode === 'grado') {
                style.text = nodo.grado.toString();
                // Aumentar tamaño ligeramente según el grado
                style.radius = baseStyle.radius + (nodo.grado * 2);
                if (nodo.grado === 0) style.borderColor = '#ef4444'; // Rojo si está aislado
                else style.borderColor = '#10b981'; // Verde si tiene amigos
            } 
            else if (this.currentMode === 'camino') {
                if (this.pathSelection.includes(nodo)) {
                    style.borderColor = '#06b6d4'; // Cyan para seleccionados
                    style.borderWidth = 4;
                }
            }
            else if (this.currentMode === 'conectividad') {
                style.borderColor = this.componentColors[nodo.id] || baseStyle.borderColor;
                style.borderWidth = 4;
            }

            return style;
        };

        this.renderer.edgeRenderHook = (arista, baseStyle) => {
            let style = { ...baseStyle };

            if (this.currentMode === 'camino' && this.pathResult) {
                if (this.pathResult.includes(arista.id)) {
                    style.color = '#06b6d4'; // Cyan
                    style.width = 5;
                } else {
                    style.color = 'rgba(148, 163, 184, 0.1)'; // Atenuar resto
                }
            }

            return style;
        };
    }

    updateStats() {
        document.getElementById('stat-nodes').textContent = this.grafo.nodos.size;
        document.getElementById('stat-edges').textContent = this.grafo.aristas.size;
        
        const isConexo = this.grafo.isConexo();
        const statConnected = document.getElementById('stat-connected');
        statConnected.textContent = isConexo ? 'Sí' : 'No';
        statConnected.style.color = isConexo ? '#10b981' : '#ef4444';

        const statTree = document.getElementById('stat-tree');
        if (this.grafo.isArbol()) {
            statTree.textContent = 'Árbol';
            statTree.style.color = '#10b981';
        } else if (this.grafo.hasCiclos()) {
            statTree.textContent = 'Contiene Ciclos';
            statTree.style.color = '#f59e0b';
        } else {
            statTree.textContent = 'Bosque';
            statTree.style.color = '#text-muted';
        }
    }
}
