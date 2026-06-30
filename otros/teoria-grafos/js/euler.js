/**
 * euler.js
 * 
 * Lógica del minijuego "Un Solo Trazo" basado en caminos y circuitos Eulerianos.
 */

class EulerManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.grafo = new Grafo();
        this.renderer = new GraphRenderer(canvas, this.grafo, { isReadOnly: true });
        
        this.difficulty = 'facil';
        this.state = 'idle'; // idle, playing, animating, finished
        
        this.usedEdges = new Set(); // Set de IDs de aristas usadas
        this.userPathNodes = []; // Nodos visitados en orden
        this.fails = 0;
        this.startTime = 0;
        
        this.validStarts = [];
        
        this.bindEvents();
        this.setupHooks();
    }

    startPuzzle(difficulty) {
        this.difficulty = difficulty;
        this.state = 'playing';
        this.usedEdges.clear();
        this.userPathNodes = [];
        this.fails = 0;
        this.startTime = Date.now();
        
        this.grafo.clear();
        this.generateEulerianGraph(difficulty);
        
        document.getElementById('euler-screen').classList.add('hidden');
        document.getElementById('euler-result-screen').classList.add('hidden');
        this.updateUI();
    }

    generateEulerianGraph(difficulty) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        let numNodes = 4;
        let numExtraCycles = 0;
        let isCircuit = true; // Fácil
        
        if (difficulty === 'facil') {
            numNodes = 4 + Math.floor(Math.random() * 2); // 4-5
            numExtraCycles = 0; // Solo un ciclo simple, aristas = N
            isCircuit = true;
        } else if (difficulty === 'medio') {
            numNodes = 6 + Math.floor(Math.random() * 2); // 6-7
            numExtraCycles = 1; // Un ciclo extra, aristas = N - 1 + 3 = N + 2 (camino)
            isCircuit = false;
        } else if (difficulty === 'dificil') {
            numNodes = 8 + Math.floor(Math.random() * 3); // 8-10
            numExtraCycles = 2; // Dos ciclos extra
            isCircuit = false;
        }

        // Generar posiciones aleatorias con separación
        const nodes = [];
        const margin = 50;
        for (let i = 0; i < numNodes; i++) {
            let x, y, valid;
            let attempts = 0;
            do {
                valid = true;
                x = margin + Math.random() * (w - 2 * margin);
                y = margin + Math.random() * (h - 2 * margin);
                for (let j = 0; j < nodes.length; j++) {
                    const dist = Math.hypot(nodes[j].x - x, nodes[j].y - y);
                    if (dist < 70) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            } while (!valid && attempts < 100);
            
            // Etiquetar numéricamente para este juego
            const label = (i + 1).toString();
            nodes.push(this.grafo.addNodo(x, y, label));
        }

        // Ordenar nodos al azar para construir la base
        const shuffled = [...nodes].sort(() => Math.random() - 0.5);

        // Construir base
        if (isCircuit) {
            // Ciclo que visita todos los nodos (grado 2)
            for (let i = 0; i < shuffled.length; i++) {
                const u = shuffled[i];
                const v = shuffled[(i + 1) % shuffled.length];
                this.grafo.addArista(u.id, v.id);
            }
        } else {
            // Camino que visita todos los nodos (2 impares, el resto 2)
            for (let i = 0; i < shuffled.length - 1; i++) {
                const u = shuffled[i];
                const v = shuffled[i + 1];
                this.grafo.addArista(u.id, v.id);
            }
        }

        // Añadir ciclos extra de tamaño 3 para incrementar complejidad
        for (let c = 0; c < numExtraCycles; c++) {
            let cycleAdded = false;
            let attempts = 0;
            while (!cycleAdded && attempts < 20) {
                const sub = [...nodes].sort(() => Math.random() - 0.5).slice(0, 3);
                const a = sub[0], b = sub[1], cNode = sub[2]; 
                
                const hasAB = this.grafo.adjList.get(a.id).some(adj => adj.node === b.id);
                const hasBC = this.grafo.adjList.get(b.id).some(adj => adj.node === cNode.id);
                const hasCA = this.grafo.adjList.get(cNode.id).some(adj => adj.node === a.id);
                
                if (!hasAB && !hasBC && !hasCA) {
                    this.grafo.addArista(a.id, b.id);
                    this.grafo.addArista(b.id, cNode.id);
                    this.grafo.addArista(cNode.id, a.id);
                    cycleAdded = true;
                }
                attempts++;
            }
        }

        // Identificar nodos de inicio válidos
        this.validStarts = [];
        const oddNodes = [];
        for (const nodo of this.grafo.getNodos()) {
            if (nodo.grado % 2 !== 0) {
                oddNodes.push(nodo);
            }
        }

        if (oddNodes.length === 0) {
            // Circuito: cualquier nodo es válido
            this.validStarts = this.grafo.getNodos();
        } else {
            // Camino: solo los impares son válidos
            this.validStarts = oddNodes;
        }
    }

    bindEvents() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.state !== 'playing' || e.button !== 0) return;
            
            const clickedNode = this.renderer.hoveredNode;
            if (clickedNode) {
                this.handleNodeClick(clickedNode);
            }
        });

        document.getElementById('btn-start-euler').addEventListener('click', () => {
            const diff = document.getElementById('euler-difficulty').value;
            this.startPuzzle(diff);
        });
        
        document.getElementById('btn-euler-new').addEventListener('click', () => {
            const diff = document.getElementById('euler-difficulty').value;
            this.startPuzzle(diff);
        });

        document.getElementById('btn-euler-restart').addEventListener('click', () => {
            // Reiniciar el mismo grafo
            this.state = 'playing';
            this.usedEdges.clear();
            this.userPathNodes = [];
            this.fails = 0;
            document.getElementById('euler-result-screen').classList.add('hidden');
            this.updateUI();
        });

        document.getElementById('btn-euler-undo').addEventListener('click', () => {
            if (this.userPathNodes.length > 1) {
                const currentNode = this.userPathNodes.pop(); // quitar el último
                const prevNode = this.userPathNodes[this.userPathNodes.length - 1]; // el que queda
                
                // Encontrar la arista entre currentNode y prevNode
                const edge = this.grafo.adjList.get(prevNode.id).find(a => a.node === currentNode.id);
                if (edge) {
                    this.usedEdges.delete(edge.edge);
                }
                
                if (this.state === 'deadend') {
                    this.state = 'playing';
                    document.getElementById('euler-result-screen').classList.add('hidden');
                }
                this.updateUI();
            } else if (this.userPathNodes.length === 1) {
                // Deshacer el nodo inicial
                this.userPathNodes = [];
                this.updateUI();
            }
        });

        document.getElementById('btn-euler-hint').addEventListener('click', () => {
            // Simple pista: resaltar los validStarts
            if (this.state === 'playing') {
                this.renderer.canvas.dispatchEvent(new Event('highlight-hint'));
                setTimeout(() => {
                    this.renderer.canvas.dispatchEvent(new Event('remove-hint'));
                }, 2000);
            }
        });
    }

    handleNodeClick(nodo) {
        if (this.userPathNodes.length === 0) {
            // Validar que se inicie en un nodo válido
            if (this.validStarts.includes(nodo) || this.validStarts.length === this.grafo.getNodos().length) {
                this.userPathNodes.push(nodo);
                this.updateUI();
            } else {
                this.flashError(nodo);
            }
            return;
        }

        const lastNode = this.userPathNodes[this.userPathNodes.length - 1];
        
        // Permitir deshacer clicando el nodo actual (igual que en Viajero Óptimo)
        if (this.userPathNodes.length > 1 && nodo === lastNode) {
            const prevNode = this.userPathNodes[this.userPathNodes.length - 2];
            const edge = this.grafo.adjList.get(prevNode.id).find(a => a.node === nodo.id);
            if (edge) this.usedEdges.delete(edge.edge);
            this.userPathNodes.pop();
            this.updateUI();
            return;
        }
        
        // Verificar adyacencia
        const edgeData = this.grafo.adjList.get(lastNode.id).find(a => a.node === nodo.id);
        
        if (!edgeData) {
            this.flashError(nodo);
            return;
        }

        // Verificar si la arista ya fue usada
        if (this.usedEdges.has(edgeData.edge)) {
            this.flashError(nodo);
            return;
        }

        // Movimiento válido
        this.usedEdges.add(edgeData.edge);
        this.userPathNodes.push(nodo);
        
        this.checkGameState();
        this.updateUI();
    }
    
    flashError(nodo) {
        this.fails++;
        
        // Reiniciar el progreso para penalizar los clics aleatorios (fuerza bruta)
        this.usedEdges.clear();
        this.userPathNodes = [];
        this.updateUI();
        
        // Efecto visual simple
        const oldLabel = nodo.label;
        nodo.label = "❌";
        setTimeout(() => {
            nodo.label = oldLabel;
        }, 500);
    }

    checkGameState() {
        const totalEdges = this.grafo.getAristas().length;
        
        if (this.usedEdges.size === totalEdges) {
            // ¡Victoria!
            this.showResults(true);
            return;
        }

        // Verificar si hay salida desde el nodo actual
        const lastNode = this.userPathNodes[this.userPathNodes.length - 1];
        const hasAvailableEdge = this.grafo.adjList.get(lastNode.id).some(adj => !this.usedEdges.has(adj.edge));
        
        if (!hasAvailableEdge) {
            // Sin salida
            this.showResults(false);
        }
    }

    showResults(success) {
        this.state = success ? 'finished' : 'deadend';
        
        const screen = document.getElementById('euler-result-screen');
        
        if (success) {
            const timeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
            const score = Math.max(100, 1000 - (this.fails * 50) - (timeSeconds * 2));
            
            screen.innerHTML = `
                <h3 style="color: var(--success)">¡Completado!</h3>
                <p>¡Trazaste todas las aristas sin levantar el lápiz!</p>
                <p>Tiempo: ${timeSeconds}s</p>
                <p>Intentos fallidos: ${this.fails}</p>
                <p>Puntuación: <strong class="text-gradient">${score}</strong></p>
                <button id="btn-euler-options" class="btn-primary" style="margin-top: 1rem;">Opciones</button>
            `;
        } else {
            screen.innerHTML = `
                <h3 style="color: var(--warning)">Sin Salida</h3>
                <p>Te has quedado atascado sin aristas libres.</p>
                <p>¡Usa el botón Deshacer o Reintentar!</p>
                <button id="btn-euler-options" class="btn-primary" style="margin-top: 1rem;">Opciones</button>
            `;
        }
        
        screen.classList.remove('hidden');
        
        // Agregar listener al nuevo botón
        document.getElementById('btn-euler-options').addEventListener('click', () => {
            this.state = 'idle';
            this.grafo.clear();
            screen.classList.add('hidden');
            document.getElementById('euler-screen').classList.remove('hidden');
            this.updateUI();
        });
        this.updateUI();
    }

    updateUI() {
        const totalEdges = this.grafo.getAristas().length;
        document.getElementById('euler-edges-counter').textContent = `${this.usedEdges.size} / ${totalEdges}`;
        document.getElementById('euler-fails').textContent = this.fails;
        
        document.getElementById('btn-euler-undo').disabled = this.userPathNodes.length === 0 || this.state === 'finished';
    }

    setupHooks() {
        let isHintActive = false;
        
        this.canvas.addEventListener('highlight-hint', () => { isHintActive = true; });
        this.canvas.addEventListener('remove-hint', () => { isHintActive = false; });

        this.renderer.nodeRenderHook = (nodo, baseStyle) => {
            let style = { ...baseStyle };
            
            if (this.state === 'playing') {
                if (this.userPathNodes.length === 0) {
                    // Estado inicial: resaltar posibles inicios en facil/medio o si hay pista
                    if (this.difficulty !== 'dificil' || isHintActive) {
                        if (this.validStarts.includes(nodo)) {
                            style.borderColor = '#10b981'; // Verde
                            style.borderWidth = 4;
                            if (isHintActive) {
                                style.color = 'rgba(16, 185, 129, 0.3)';
                                style.borderColor = '#f59e0b'; // Amarillo para pista
                            }
                        }
                    }
                } else {
                    // Resaltar el nodo actual (dónde está el lápiz)
                    const lastNode = this.userPathNodes[this.userPathNodes.length - 1];
                    if (nodo === lastNode) {
                        style.borderColor = '#06b6d4'; // Cyan
                        style.borderWidth = 4;
                    }
                }
            }

            return style;
        };

        this.renderer.edgeRenderHook = (arista, baseStyle) => {
            let style = { ...baseStyle };
            
            if (this.usedEdges.has(arista.id)) {
                style.color = '#06b6d4'; // Resaltado cyan
                style.width = 6;
            } else if (this.userPathNodes.length > 0) {
                // Atenuar no usadas
                style.color = 'rgba(148, 163, 184, 0.2)';
            }
            
            return style;
        };
    }
}
