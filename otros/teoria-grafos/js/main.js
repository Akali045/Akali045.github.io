/**
 * main.js
 * 
 * Orquestación principal de la aplicación, manejo de pestañas (routing simple) y arranque.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Manejo de Navegación (Tabs) ---
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section-view');

    function navigateTo(sectionId) {
        // Actualizar links
        navLinks.forEach(link => {
            if (link.dataset.section === sectionId) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Actualizar vistas
        sections.forEach(section => {
            if (section.id === sectionId) {
                section.classList.remove('hidden');
                section.classList.add('active');
            } else {
                section.classList.add('hidden');
                section.classList.remove('active');
            }
        });
        
        // Trigger resize events para los canvas si estamos entrando a sus secciones
        if (sectionId === 'explora') {
            window.dispatchEvent(new Event('resize'));
        } else if (sectionId === 'desafio') {
            window.dispatchEvent(new Event('resize'));
            if (!window.challengeManager) {
                initChallenge();
            }
        }
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.section);
            window.history.pushState(null, '', `#${link.dataset.section}`);
        });
    });

    // Leer el hash inicial para routing simple
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        navigateTo(hash);
    }

    // --- Inicializar Sandbox ---
    const sandboxCanvas = document.getElementById('graphCanvas');
    const sandboxGrafo = new Grafo();
    const sandboxRenderer = new GraphRenderer(sandboxCanvas, sandboxGrafo);
    const sandboxManager = new SandboxManager(sandboxGrafo, sandboxRenderer);

    // Agregar algunos nodos de ejemplo al sandbox
    setTimeout(() => {
        const w = sandboxCanvas.width;
        const h = sandboxCanvas.height;
        if (w > 0 && h > 0) {
            const n1 = sandboxGrafo.addNodo(w*0.3, h*0.3);
            const n2 = sandboxGrafo.addNodo(w*0.7, h*0.3);
            const n3 = sandboxGrafo.addNodo(w*0.5, h*0.7);
            sandboxGrafo.addArista(n1.id, n2.id);
            sandboxGrafo.addArista(n2.id, n3.id);
            sandboxManager.updateStats();
        }
    }, 100);

    // Eventos Sandbox UI
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            sandboxManager.setMode(e.target.dataset.mode);
        });
    });

    document.getElementById('btn-clear').addEventListener('click', () => {
        sandboxGrafo.clear();
        sandboxManager.updateStats();
    });

    sandboxCanvas.addEventListener('click', () => {
        sandboxManager.handleClick(sandboxRenderer.hoveredNode);
        sandboxManager.updateStats();
    });

    sandboxCanvas.addEventListener('graph-changed', () => {
        sandboxManager.updateStats();
    });

    // --- Inicializar Desafío ---
    function initChallenge() {
        if (!window.challengeManager) {
            const challengeCanvas = document.getElementById('challengeCanvas');
            window.challengeManager = new ChallengeManager(challengeCanvas);
        }
        if (!window.eulerManager) {
            const eulerCanvas = document.getElementById('eulerCanvas');
            if (typeof EulerManager !== 'undefined') {
                window.eulerManager = new EulerManager(eulerCanvas);
            }
        }
    }

    // --- Menú de Desafíos ---
    const menuContainer = document.getElementById('desafio-menu');
    const viajeroContainer = document.getElementById('viajero-container');
    const eulerContainer = document.getElementById('euler-container');

    document.querySelectorAll('.challenge-card').forEach(card => {
        card.addEventListener('click', () => {
            const game = card.dataset.game;
            menuContainer.classList.remove('active');
            menuContainer.classList.add('hidden');

            if (game === 'viajero') {
                viajeroContainer.classList.remove('hidden');
                viajeroContainer.classList.add('active');
            } else if (game === 'euler') {
                eulerContainer.classList.remove('hidden');
                eulerContainer.classList.add('active');
            }
            window.dispatchEvent(new Event('resize'));
        });
    });

    document.querySelectorAll('.btn-back-menu').forEach(btn => {
        btn.addEventListener('click', () => {
            viajeroContainer.classList.add('hidden');
            viajeroContainer.classList.remove('active');
            eulerContainer.classList.add('hidden');
            eulerContainer.classList.remove('active');
            
            menuContainer.classList.remove('hidden');
            menuContainer.classList.add('active');
        });
    });
});
