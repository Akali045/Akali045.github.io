/**
 * desafio.js
 * 
 * Lógica del minijuego Desafío: El Viajero Óptimo.
 */

class ChallengeManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.grafo = new Grafo();
        this.renderer = new GraphRenderer(canvas, this.grafo, { isReadOnly: true });
        
        this.currentRound = 1;
        this.maxRounds = 3;
        this.totalScore = 0;
        this.difficulty = 'facil';
        
        this.startNode = null;
        this.endNode = null;
        
        this.userPathNodes = []; // Array de Nodos seleccionados por el usuario
        this.userTotalWeight = 0;
        
        this.state = 'idle'; // idle, playing, animating, finished
        this.dijkstraRunner = null;
        
        this.setupHooks();
        this.bindEvents();
    }

    startRound(round) {
        this.currentRound = round;
        this.state = 'playing';
        this.userPathNodes = [];
        this.userTotalWeight = 0;
        this.updateUI();
        
        this.grafo.clear();
        this.generateRandomGraph(this.difficulty);
        
        // El primer nodo del camino del usuario es el origen
        this.userPathNodes.push(this.startNode);
        
        document.getElementById('challenge-screen').classList.add('hidden');
    }

    generateRandomGraph(difficulty) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        let numNodes = 4;
        let numEdges = 5;
        let maxWeight = 10;
        
        if (difficulty === 'medio') {
            numNodes = 6;
            numEdges = 8;
            maxWeight = 20;
        } else if (difficulty === 'dificil') {
            numNodes = 8;
            numEdges = 12;
            maxWeight = 30;
        }

        // Posiciones aleatorias con separación mínima
        const nodes = [];
        const margin = 40;
        for (let i = 0; i < numNodes; i++) {
            let x, y, valid;
            let attempts = 0;
            do {
                valid = true;
                x = margin + Math.random() * (w - 2 * margin);
                y = margin + Math.random() * (h - 2 * margin);
                for (let j = 0; j < nodes.length; j++) {
                    const dist = Math.hypot(nodes[j].x - x, nodes[j].y - y);
                    if (dist < 60) {
                        valid = false;
                        break;
                    }
                }
                attempts++;
            } while (!valid && attempts < 50);
            
            const label = String.fromCharCode(65 + i); // A, B, C...
            const n = this.grafo.addNodo(x, y, label);
            nodes.push(n);
        }

        // Generar un Spanning Tree aleatorio para asegurar conectividad
        const connected = [nodes[0]];
        const unconnected = nodes.slice(1);
        let edgesCount = 0;

        while (unconnected.length > 0) {
            const uIndex = Math.floor(Math.random() * connected.length);
            const vIndex = Math.floor(Math.random() * unconnected.length);
            const u = connected[uIndex];
            const v = unconnected[vIndex];
            
            const weight = 1 + Math.floor(Math.random() * maxWeight);
            this.grafo.addArista(u.id, v.id, weight);
            edgesCount++;
            
            connected.push(v);
            unconnected.splice(vIndex, 1);
        }

        // Añadir aristas extra aleatorias
        while (edgesCount < numEdges) {
            const u = nodes[Math.floor(Math.random() * nodes.length)];
            const v = nodes[Math.floor(Math.random() * nodes.length)];
            if (u.id !== v.id) {
                // Check if edge exists
                if (!this.grafo.adjList.get(u.id).some(adj => adj.node === v.id)) {
                    const weight = 1 + Math.floor(Math.random() * maxWeight);
                    this.grafo.addArista(u.id, v.id, weight);
                    edgesCount++;
                }
            }
        }

        // Elegir inicio y fin: encontrar los dos nodos más alejados (BFS)
        const getFurthestNode = (start) => {
            const queue = [start];
            const dists = new Map();
            dists.set(start.id, 0);
            let furthest = start;
            let maxDist = 0;
            
            while (queue.length > 0) {
                const current = queue.shift();
                const d = dists.get(current.id);
                
                if (d > maxDist) {
                    maxDist = d;
                    furthest = current;
                }
                
                const adjs = this.grafo.adjList.get(current.id);
                for (const adj of adjs) {
                    if (!dists.has(adj.node)) {
                        dists.set(adj.node, d + 1);
                        queue.push(this.grafo.nodos.get(adj.node));
                    }
                }
            }
            return { furthest, maxDist };
        };

        // Encontrar los dos nodos más alejados del grafo
        const pass1 = getFurthestNode(nodes[0]);
        const pass2 = getFurthestNode(pass1.furthest);
        
        this.startNode = pass1.furthest;
        this.endNode = pass2.furthest;

        // Eliminar arista directa entre inicio y fin si existe, para forzar un camino
        const startAdjs = this.grafo.adjList.get(this.startNode.id);
        const directEdgeIndex = startAdjs.findIndex(a => a.node === this.endNode.id);
        if (directEdgeIndex !== -1) {
            const edgeId = startAdjs[directEdgeIndex].edge;
            this.grafo.removeArista(edgeId);
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

        document.getElementById('btn-undo-move').addEventListener('click', () => {
            if (this.userPathNodes.length > 1) {
                this.userPathNodes.pop();
                this.recalculateUserWeight();
                this.updateUI();
            }
        });

        document.getElementById('btn-submit-route').addEventListener('click', () => {
            if (this.userPathNodes[this.userPathNodes.length - 1] === this.endNode) {
                this.evaluateRoute();
            }
        });

        document.getElementById('btn-start-challenge').addEventListener('click', () => {
            if (this.currentRound > this.maxRounds) {
                this.resetGame();
            } else {
                const diffSelect = document.getElementById('dijkstra-difficulty');
                if (diffSelect) this.difficulty = diffSelect.value;
                this.startRound(this.currentRound);
            }
        });
    }

    handleNodeClick(nodo) {
        const lastNode = this.userPathNodes[this.userPathNodes.length - 1];
        
        // Permitir deshacer la selección al hacer clic en el último nodo agregado
        if (this.userPathNodes.length > 1 && nodo === lastNode) {
            this.userPathNodes.pop();
            this.recalculateUserWeight();
            this.updateUI();
            return;
        }

        // No permitir hacer clic en nodos ya visitados en la ruta actual
        if (this.userPathNodes.includes(nodo)) return;

        // Verificar si hay una arista entre lastNode y nodo
        const adjs = this.grafo.adjList.get(lastNode.id);
        const adjEdge = adjs.find(a => a.node === nodo.id);

        if (adjEdge) {
            this.userPathNodes.push(nodo);
            this.recalculateUserWeight();
            this.updateUI();
        }
    }

    recalculateUserWeight() {
        this.userTotalWeight = 0;
        for (let i = 0; i < this.userPathNodes.length - 1; i++) {
            const u = this.userPathNodes[i];
            const v = this.userPathNodes[i+1];
            const edge = this.grafo.adjList.get(u.id).find(a => a.node === v.id);
            if (edge) this.userTotalWeight += edge.weight;
        }
    }

    updateUI() {
        document.getElementById('round-counter').textContent = `${this.currentRound} / ${this.maxRounds}`;
        document.getElementById('total-score').textContent = this.totalScore;
        
        const list = document.getElementById('user-route-list');
        list.innerHTML = '';
        
        this.userPathNodes.forEach((nodo, i) => {
            const li = document.createElement('li');
            li.textContent = nodo.label;
            if (i === 0) li.style.color = 'var(--accent)';
            if (i === this.userPathNodes.length - 1 && nodo === this.endNode) li.style.color = 'var(--danger)';
            list.appendChild(li);
        });

        document.getElementById('user-total-weight').textContent = this.userTotalWeight;
        
        const btnUndo = document.getElementById('btn-undo-move');
        const btnSubmit = document.getElementById('btn-submit-route');
        
        btnUndo.disabled = this.userPathNodes.length <= 1 || this.state !== 'playing';
        btnSubmit.disabled = this.userPathNodes[this.userPathNodes.length - 1] !== this.endNode || this.state !== 'playing';
    }

    evaluateRoute() {
        this.state = 'animating';
        this.updateUI(); // Para deshabilitar botones
        
        this.dijkstraRunner = new DijkstraRunner(this.grafo, this.startNode, this.endNode);
        
        const stepAnim = () => {
            const result = this.dijkstraRunner.step();
            if (result.state === 'running') {
                setTimeout(stepAnim, 500); // 500ms por paso
            } else if (result.state === 'finished') {
                this.showResults(result.finalDist);
            }
        };
        
        setTimeout(stepAnim, 500);
    }

    showResults(optimalWeight) {
        this.state = 'finished';
        
        let pointsEarned = 0;
        if (this.userTotalWeight === optimalWeight) {
            pointsEarned = 1000;
        } else {
            // Penalización proporcional a la diferencia
            const diff = this.userTotalWeight - optimalWeight;
            pointsEarned = Math.max(0, 1000 - (diff * 100));
        }
        
        this.totalScore += pointsEarned;
        
        const screen = document.getElementById('challenge-screen');
        screen.innerHTML = `
            <h3>${pointsEarned === 1000 ? '¡Ruta Óptima!' : '¡Ruta Completada!'}</h3>
            <p>Tu tiempo: <strong>${this.userTotalWeight} min</strong></p>
            <p>Tiempo óptimo: <strong>${optimalWeight} min</strong></p>
            <p>Puntos ganados: <strong class="text-gradient">+${pointsEarned}</strong></p>
            <button id="btn-next-round" class="btn-primary">${this.currentRound < this.maxRounds ? 'Siguiente Ronda' : 'Ver Resultados Finales'}</button>
        `;
        
        document.getElementById('btn-next-round').addEventListener('click', () => {
            this.currentRound++;
            if (this.currentRound > this.maxRounds) {
                this.showFinalScreen();
            } else {
                this.startRound(this.currentRound);
            }
        });
        
        screen.classList.remove('hidden');
        this.updateUI();
    }
    
    showFinalScreen() {
        const screen = document.getElementById('challenge-screen');
        screen.innerHTML = `
            <h3>¡Desafío Completado!</h3>
            <p>Has puesto a prueba tus conocimientos sobre grafos.</p>
            <p>Puntuación Final: <strong style="font-size: 2rem" class="text-gradient">${this.totalScore}</strong> / 3000</p>
            <button id="btn-restart-game" class="btn-primary">Jugar de Nuevo</button>
        `;
        document.getElementById('btn-restart-game').addEventListener('click', () => this.resetGame());
    }
    
    resetGame() {
        this.totalScore = 0;
        this.currentRound = 1;
        const screen = document.getElementById('challenge-screen');
        screen.innerHTML = `
            <h3>¡Preparado!</h3>
            <p>Encuentra la ruta más corta (suma de tiempos) entre el nodo <span class="origin-badge">Origen</span> y el <span class="dest-badge">Destino</span>.</p>
            <div class="difficulty-selector" style="margin: 1rem 0;">
                <label>Dificultad:</label>
                <select id="dijkstra-difficulty" style="padding: 0.5rem; border-radius: 5px; background: var(--panel-bg); color: var(--text-light); border: 1px solid var(--border-color);">
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                </select>
            </div>
            <button id="btn-start-challenge" class="btn-primary">Empezar Ronda</button>
        `;
        document.getElementById('btn-start-challenge').addEventListener('click', () => {
            const diffSelect = document.getElementById('dijkstra-difficulty');
            if (diffSelect) this.difficulty = diffSelect.value;
            this.startRound(this.currentRound);
        });
        screen.classList.remove('hidden');
    }

    setupHooks() {
        this.renderer.nodeRenderHook = (nodo, baseStyle) => {
            let style = { ...baseStyle };
            
            if (nodo === this.startNode) {
                style.borderColor = '#10b981'; // Accent
                style.borderWidth = 4;
            } else if (nodo === this.endNode) {
                style.borderColor = '#ef4444'; // Danger
                style.borderWidth = 4;
            }

            if (this.state === 'playing' || this.state === 'animating' || this.state === 'finished') {
                if (this.userPathNodes.includes(nodo)) {
                    style.color = '#334155'; // Resaltar recorrido usuario
                }
            }

            // Animación Dijkstra
            if (this.state === 'animating' && this.dijkstraRunner) {
                if (this.dijkstraRunner.visitados.has(nodo.id)) {
                    style.borderColor = '#06b6d4'; // Cyan
                    style.text = this.dijkstraRunner.distancias.get(nodo.id).toString();
                } else if (this.dijkstraRunner.distancias.get(nodo.id) !== Infinity) {
                    style.borderColor = '#f59e0b'; // Amber (descubierto pero no procesado)
                    style.text = this.dijkstraRunner.distancias.get(nodo.id).toString();
                }
            }

            return style;
        };

        this.renderer.edgeRenderHook = (arista, baseStyle) => {
            let style = { ...baseStyle };
            
            // Mostrar pesos
            const ctx = this.renderer.ctx;
            const u = this.grafo.nodos.get(arista.u);
            const v = this.grafo.nodos.get(arista.v);
            const midX = (u.x + v.x) / 2;
            const midY = (u.y + v.y) / 2;
            
            // Encontrar si esta arista es parte del camino del usuario
            let inUserPath = false;
            for(let i=0; i<this.userPathNodes.length-1; i++){
                if((this.userPathNodes[i].id === arista.u && this.userPathNodes[i+1].id === arista.v) ||
                   (this.userPathNodes[i].id === arista.v && this.userPathNodes[i+1].id === arista.u)) {
                    inUserPath = true;
                    break;
                }
            }

            if (inUserPath) {
                style.color = 'rgba(255, 255, 255, 0.4)';
                style.width = 4;
            }

            if (this.state === 'finished' && this.dijkstraRunner) {
                if (this.dijkstraRunner.path.includes(arista.id)) {
                    style.color = '#06b6d4'; // Resaltar ruta óptima
                    style.width = 6;
                }
            }

            style.label = arista.weight + 'm';
            style.labelBgColor = 'rgba(15, 23, 42, 0.7)';
            style.labelColor = '#f8fafc';
            style.font = 'bold 12px Inter';

            return style;
        };
    }
}
