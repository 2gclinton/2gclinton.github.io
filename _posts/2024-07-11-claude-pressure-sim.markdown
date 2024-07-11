---
layout: post
title:  "Claude Pressure Simulator"
date:   2024-07-11 10:55:10 -0400
categories: AI code
---
Claude.ai recently released the ability to publish "artifacts" -- which are live views of the code (or graphs, or drawings, or outlines, etc.) that it produces based on a user prompt.

Way back when, in the good old days of last year, when getting ChatGPT to help me code interactive websites, I got it to help me develop a simulation of gas pressure in a container. We were working in HTML, CSS and JS. The implementation was simple -- open the file in a browser.

Here is that simulation:
<html>
<head>
    <title>Gas Pressure Simulator</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        #game-container {
            text-align: center;
            margin: auto;
            width: 520px;
            font-family:Arial, Helvetica, sans-serif;
        }

        #bps-display {
            padding-top: 10px;
        }

        #gameCanvas {
            border: 3px solid black;
        }
    </style>
</head>
<body>
    <div id="game-container">
        <h1>Gas Pressure Simulator</h1>
        <button id="start-button">Start</button>
        <button id="reset-button">Reset</button>
        <button id="pause-button">Pause</button>
        <div id="bps-display">Bounces per Second: <span id="bps-value">0</span></div>
        <div id="bounce-counter">Bounce Count: <span id="bounce-count">0</span></div>
        <h3>Temperature: <span id="temperature-value">25</span>°C</h3>
        <input type="range" id="temperature-slider" min="0" max="100" value="25">
        <canvas id="gameCanvas" width="500" height="500"></canvas>
        <h2>Bounce Count Over Time</h2>
        <canvas id="bounceChart" width="500" height="200"></canvas>
    </div>
    <script>
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const bounceCountElement = document.getElementById('bounce-count');

        let particles = [];
        let isRunning = false;
        let bounceCount = 0;
        let timeElapsed = 0;
        let temperature = 25; // Default temperature set to 25°C
        let speedMultiplier = 2;
        let isPaused = false;
        let graphUpdateInterval;
        let prevBounceCount = 0;
let prevTime = 0;
        const timeData = [];
        const bounceData = [];

        // Initialize Chart.js
        const bounceChartCtx = document.getElementById('bounceChart').getContext('2d');
        const bounceChart = new Chart(bounceChartCtx, {
            type: 'line',
            data: {
                labels: timeData,
                datasets: [{
                    label: 'Bounce Count',
                    data: bounceData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: {
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom'
                    }
                }
            }
        });

        function initializeParticles() {
            particles = [];
            bounceCount = 0;
            bounceCountElement.textContent = bounceCount;
            for (let i = 0; i < 100; i++) {
                particles.push({
                x: Math.random() * 250,
                y: Math.random() * 500,
                dx: (Math.random() * 5 - 2) * speedMultiplier,
                dy: (Math.random() * 5 - 2) * speedMultiplier
                });
            }
        }

        function drawParticles() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'blue';
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        function updateParticles() {
            particles.forEach(p => {
                const newX = p.x + p.dx;
                const newY = p.y + p.dy;

            if (newX < 0 || newX > 500) {
            p.dx = -p.dx;
            bounceCount++;
            } else {
            p.x = newX;
            }

            if (newY < 0 || newY > 500) {
            p.dy = -p.dy;
            bounceCount++;
            } else {
            p.y = newY;
            }
        });
            bounceCountElement.textContent = bounceCount;
        }

        function updateParticleSpeed() {
    const maxSpeed = 10; // Maximum speed at 100°C
    const minSpeed = 0;  // Minimum speed at 0°C
    const tempFactor = (maxSpeed - minSpeed) * (temperature / 100) + minSpeed;
    particles.forEach(p => {
        p.dx = p.dx / speedMultiplier * tempFactor;
        p.dy = p.dy / speedMultiplier * tempFactor;
    });
    speedMultiplier = tempFactor;
}

     /*   function updateSpeedMultiplier() {
        speedMultiplier = temperature / 100;
        document.getElementById('temperature-value').textContent = temperature;
        }
    */
        
        function updateBouncesPerSecond() {
            const currentTime = Date.now();
            const deltaTime = (currentTime - prevTime) / 1000; // Time in seconds
            const deltaBounces = bounceCount - prevBounceCount;
            
            const bps = (deltaBounces / deltaTime).toFixed(2);
            document.getElementById('bps-value').textContent = bps;
            
            prevBounceCount = bounceCount;
            prevTime = currentTime;
        }

        function updateGraph() {
            timeElapsed += 0.5;
            timeData.push(timeElapsed);
            bounceData.push(bounceCount);
            bounceChart.update();
        }

        function gameLoop() {
            if (isRunning && !isPaused) {
            drawParticles();
            updateParticles();
            requestAnimationFrame(gameLoop);
            } else if (isRunning && isPaused) {
            requestAnimationFrame(gameLoop);
            }
        }

        document.getElementById('start-button').addEventListener('click', () => {
            if (!isRunning) {
                isRunning = true;
                gameLoop();
                graphUpdateInterval = setInterval(() => {
                if (!isPaused) {
                    updateGraph();
                    updateBouncesPerSecond();
                }
                }, 500);
            }
            prevTime = Date.now();
        });

        document.getElementById('reset-button').addEventListener('click', () => {
            isRunning = false;
            isPaused = false; // Reset pause state
            clearInterval(graphUpdateInterval); // Clear graph update interval
            initializeParticles();
            drawParticles();
            bounceChart.update();
        });
        
        document.getElementById('temperature-slider').addEventListener('input', (event) => {
    temperature = parseInt(event.target.value);
    document.getElementById('temperature-value').textContent = temperature;
    updateParticleSpeed();
    drawParticles();
});
        
        document.getElementById('pause-button').addEventListener('click', () => {
            isPaused = !isPaused;
            document.getElementById('pause-button').textContent = isPaused ? 'Resume' : 'Pause';
        });

        initializeParticles();
        drawParticles();
    </script>
</body>
</html>

Claude built me a replica, and I added a few features (and dispensed with the live graph, for the sake of proving the concept.) This took only two prompts. The first to get the basic simulation up and running, and the second to add the pressure gauge.

Check it out here: https://claude.site/artifacts/557b9e66-524c-4558-be81-6da952727456