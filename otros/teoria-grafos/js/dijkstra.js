/**
 * dijkstra.js
 * 
 * Implementación del algoritmo de Dijkstra con soporte para animación paso a paso.
 */

class DijkstraRunner {
    constructor(grafo, startNode, endNode) {
        this.grafo = grafo;
        this.startNode = startNode;
        this.endNode = endNode;
        
        this.distancias = new Map();
        this.previos = new Map();
        this.visitados = new Set();
        this.noVisitados = new Set();
        
        // Inicialización
        this.grafo.getNodos().forEach(n => {
            this.distancias.set(n.id, Infinity);
            this.noVisitados.add(n.id);
        });
        
        this.distancias.set(this.startNode.id, 0);
        
        this.isFinished = false;
        this.path = []; // Contendrá los IDs de las aristas del camino final
    }

    // Ejecuta un paso del algoritmo (procesa un nodo)
    // Retorna { state: 'running' | 'finished' | 'unreachable', currentNode: id, edgeToCurrent: id }
    step() {
        if (this.isFinished) return { state: 'finished' };
        if (this.noVisitados.size === 0) {
            this.isFinished = true;
            return { state: 'unreachable' };
        }

        // Buscar nodo no visitado con la distancia mínima
        let minDist = Infinity;
        let current = null;

        for (const id of this.noVisitados) {
            const d = this.distancias.get(id);
            if (d < minDist) {
                minDist = d;
                current = id;
            }
        }

        // Si la distancia mínima es Infinity, los nodos restantes son inalcanzables
        if (minDist === Infinity || current === null) {
            this.isFinished = true;
            return { state: 'unreachable' };
        }

        // Si llegamos al destino, terminamos
        if (current === this.endNode.id) {
            this.isFinished = true;
            this.buildPath();
            return { state: 'finished', currentNode: current, path: this.path, finalDist: minDist };
        }

        this.noVisitados.delete(current);
        this.visitados.add(current);

        // Actualizar vecinos
        const adjs = this.grafo.adjList.get(current);
        const edgesExplored = [];

        for (const adj of adjs) {
            if (this.noVisitados.has(adj.node)) {
                const alt = this.distancias.get(current) + adj.weight;
                edgesExplored.push(adj.edge);
                if (alt < this.distancias.get(adj.node)) {
                    this.distancias.set(adj.node, alt);
                    this.previos.set(adj.node, { node: current, edge: adj.edge });
                }
            }
        }

        return { state: 'running', currentNode: current, edgesExplored: edgesExplored };
    }

    buildPath() {
        let curr = this.endNode.id;
        while (curr !== this.startNode.id) {
            if (!this.previos.has(curr)) break; // Inalcanzable
            const step = this.previos.get(curr);
            this.path.unshift(step.edge);
            curr = step.node;
        }
    }
    
    // Método auxiliar para correrlo todo de una vez (para saber el resultado real)
    runComplete() {
        while (!this.isFinished) {
            this.step();
        }
        return {
            path: this.path,
            dist: this.distancias.get(this.endNode.id)
        };
    }
}
