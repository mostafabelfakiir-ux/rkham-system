document.addEventListener('DOMContentLoaded', () => {
    // Wait a brief moment to ensure the UI is fully rendered
    setTimeout(initTradingChart, 500);
});

// Also re-init or resize when switching to the home tab if needed
// We can hook into the switchTab function if we want, but usually just initializing it once and using ResizeObserver is better.

function initTradingChart() {
    const container = document.getElementById('trading-chart-container');
    if (!container) return;

    // Use ResizeObserver to automatically resize the chart when the container size changes
    const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            textColor: '#d1d4dc',
            background: { type: 'solid', color: '#1a1a2e' },
        },
        grid: {
            vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
            horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
        },
        timeScale: {
            borderColor: 'rgba(197, 203, 206, 0.8)',
            timeVisible: true,
            secondsVisible: true,
        },
    });

    const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderDownColor: '#ef4444',
        borderUpColor: '#10b981',
        wickDownColor: '#ef4444',
        wickUpColor: '#10b981',
    });

    // Generate initial fake data
    const fakeData = [];
    let currentTime = Math.floor(Date.now() / 1000) - 100 * 60; // 100 minutes ago
    let lastClose = 150.00;

    for (let i = 0; i < 100; i++) {
        const open = lastClose + (Math.random() - 0.5) * 2;
        const close = open + (Math.random() - 0.5) * 4;
        const high = Math.max(open, close) + Math.random() * 2;
        const low = Math.min(open, close) - Math.random() * 2;
        
        fakeData.push({
            time: currentTime,
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
        });
        
        lastClose = close;
        currentTime += 60; // 1 minute interval
    }

    candleSeries.setData(fakeData);

    // Live update simulation
    const livePriceEl = document.getElementById('live-price');
    
    let currentBar = {
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
        time: currentTime
    };

    setInterval(() => {
        const tick = lastClose + (Math.random() - 0.5) * 1.5; // Random price movement
        lastClose = tick;

        const now = Math.floor(Date.now() / 1000);
        
        // Start a new candle every 60 seconds
        if (now >= currentBar.time + 60) {
            currentBar = {
                open: tick,
                high: tick,
                low: tick,
                close: tick,
                time: Math.floor(now / 60) * 60
            };
        } else {
            currentBar.high = Math.max(currentBar.high, tick);
            currentBar.low = Math.min(currentBar.low, tick);
            currentBar.close = tick;
        }

        candleSeries.update({
            time: currentBar.time,
            open: parseFloat(currentBar.open.toFixed(2)),
            high: parseFloat(currentBar.high.toFixed(2)),
            low: parseFloat(currentBar.low.toFixed(2)),
            close: parseFloat(currentBar.close.toFixed(2))
        });

        if (livePriceEl) {
            livePriceEl.textContent = tick.toFixed(2) + ' DH';
            if (currentBar.close >= currentBar.open) {
                livePriceEl.style.color = '#10b981';
            } else {
                livePriceEl.style.color = '#ef4444';
            }
        }
    }, 1000); // update every second

    // Make chart responsive
    new ResizeObserver(entries => {
        if (entries.length === 0 || entries[0].target !== container) { return; }
        const newRect = entries[0].contentRect;
        chart.applyOptions({ height: newRect.height, width: newRect.width });
    }).observe(container);
}
