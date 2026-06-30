/**
 * grafo.js
 * 
 * Estructura de datos principal para el grafo.
 * Maneja nodos, aristas, y algoritmos básicos como DFS/BFS para conectividad y ciclos.
 */

class Nodo {
    constructor(id, x, y, label = '') {
        this.id = id;
        this.x = x;
        this.y = y;
        this.label = label || id.toString();
        this.grado = 0;
    }
}

class Arista {
    constructor(id, u, v, weight = 1) {
        this.id = id;
        this.u = u; // ID del nodo origen
        this.v = v; // ID del nodo destino
        this.weight = weight;
    }
}

class Grafo {
    constructor() {
        this.nodos = new Map(); // id -> Nodo
        this.aristas = new Map(); // id -> Arista
        this.adjList = new Map(); // id -> array de objetos { node: id, edge: id, weight: number }
        this.nextId = 1;
    }

    addNodo(x, y, label = '') {
        const id = this.nextId++;
        const nodo = new Nodo(id, x, y, label);
        this.nodos.set(id, nodo);
        this.adjList.set(id, []);
        return nodo;
    }

    removeNodo(id) {
        if (!this.nodos.has(id)) return false;
        
        // Eliminar aristas conectadas
        const connectedEdges = this.adjList.get(id);
        const edgeIdsToRemove = connectedEdges.map(e => e.edge);
        edgeIdsToRemove.forEach(edgeId => this.removeArista(edgeId));

        // Eliminar nodo
        this.nodos.delete(id);
        this.adjList.delete(id);
        return true;
    }

    addArista(u, v, weight = 1) {
        // Evitar auto-bucles y aristas duplicadas
        if (u === v) return null;
        if (this.adjList.get(u).some(adj => adj.node === v)) return null;

        const id = `${u}-${v}`;
        const arista = new Arista(id, u, v, weight);
        this.aristas.set(id, arista);

        // Grafo no dirigido
        this.adjList.get(u).push({ node: v, edge: id, weight });
        this.adjList.get(v).push({ node: u, edge: id, weight });

        // Actualizar grados
        this.nodos.get(u).grado++;
        this.nodos.get(v).grado++;

        return arista;
    }

    removeArista(id) {
        if (!this.aristas.has(id)) return false;
        const arista = this.aristas.get(id);
        const { u, v } = arista;

        this.aristas.delete(id);

        this.adjList.set(u, this.adjList.get(u).filter(adj => adj.edge !== id));
        this.adjList.set(v, this.adjList.get(v).filter(adj => adj.edge !== id));

        this.nodos.get(u).grado--;
        this.nodos.get(v).grado--;

        return true;
    }

    getNodos() {
        return Array.from(this.nodos.values());
    }

    getAristas() {
        return Array.from(this.aristas.values());
    }

    clear() {
        this.nodos.clear();
        this.aristas.clear();
        this.adjList.clear();
        this.nextId = 1;
    }

    // --- Algoritmos Básicos ---

    // Retorna un array de componentes conexas (cada componente es un array de IDs de nodos)
    getComponentesConexas() {
        const visitados = new Set();
        const componentes = [];

        for (const [id] of this.nodos) {
            if (!visitados.has(id)) {
                const componenteActual = [];
                const cola = [id];
                visitados.add(id);

                while (cola.length > 0) {
                    const actual = cola.shift();
                    componenteActual.push(actual);

                    for (const adj of this.adjList.get(actual)) {
                        if (!visitados.has(adj.node)) {
                            visitados.add(adj.node);
                            cola.push(adj.node);
                        }
                    }
                }
                componentes.push(componenteActual);
            }
        }
        return componentes;
    }

    isConexo() {
        if (this.nodos.size === 0) return true;
        return this.getComponentesConexas().length === 1;
    }

    // Retorna true si contiene al menos un ciclo
    hasCiclos() {
        const visitados = new Set();

        const dfs = (nodo, padre) => {
            visitados.add(nodo);
            for (const adj of this.adjList.get(nodo)) {
                if (!visitados.has(adj.node)) {
                    if (dfs(adj.node, nodo)) return true;
                } else if (adj.node !== padre) {
                    return true; // Encontramos un nodo ya visitado que no es el padre -> ciclo
                }
            }
            return false;
        };

        for (const [id] of this.nodos) {
            if (!visitados.has(id)) {
                if (dfs(id, null)) return true;
            }
        }
        return false;
    }

    isArbol() {
        return this.isConexo() && !this.hasCiclos();
    }
}
