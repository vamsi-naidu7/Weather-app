
document.addEventListener('DOMContentLoaded', () => {
    const locationInput = document.getElementById('locationInput');
    const searchButton = document.getElementById('searchButton');
    const weatherDisplay = document.getElementById('weatherDisplay');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const errorDisplay = document.getElementById('errorDisplay');

    const locationNameEl = document.getElementById('locationName');
    const currentDateEl = document.getElementById('currentDate');
    const currentIconEl = document.getElementById('currentIcon');
    const currentTempEl = document.getElementById('currentTemp');
    const currentConditionEl = document.getElementById('currentCondition');
    const currentFeelsLikeEl = document.getElementById('currentFeelsLike');
    const currentHumidityEl = document.getElementById('currentHumidity');
    const currentWindEl = document.getElementById('currentWind');
    const hourlyForecastScrollerEl = document.getElementById('hourlyForecastScroller');

    const currentWeatherCard = document.querySelector('.current-weather-card');
    const hourlyForecastCard = document.querySelector('.hourly-forecast-card');

    searchButton.addEventListener('click', handleSearch);
    locationInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });

    function handleSearch() {
        const locationQuery = locationInput.value.trim();
        if (!locationQuery) {
            showError("Please enter a location.");
            return;
        }
        fetchWeatherData(locationQuery);
    }

    async function fetchWeatherData(locationQuery) {
        showLoading(true);
        hideError();
        hideWeatherCards();

        try {
            // 1. Geocode location to get latitude and longitude
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1&language=en&format=json`;
            const geoResponse = await fetch(geoUrl);
            if (!geoResponse.ok) {
                throw new Error(`Geocoding error: ${geoResponse.statusText}`);
            }
            const geoData = await geoResponse.json();

            if (!geoData.results || geoData.results.length === 0) {
                throw new Error(`Location "${locationQuery}" not found.`);
            }

            const { latitude, longitude, name, admin1, country } = geoData.results[0];
            const displayName = `${name}${admin1 ? ', ' + admin1 : ''}, ${country}`;

            // 2. Fetch weather data using coordinates
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto&forecast_days=1`;
            const weatherResponse = await fetch(weatherUrl);
            if (!weatherResponse.ok) {
                throw new Error(`Weather data error: ${weatherResponse.statusText}`);
            }
            const weatherData = await weatherResponse.json();
            
            displayWeatherData(weatherData, displayName);

        } catch (error) {
            console.error("Error fetching weather data:", error);
            showError(error.message || "Failed to fetch weather data. Please try again.");
        } finally {
            showLoading(false);
        }
    }

    function displayWeatherData(data, displayName) {
        hideError();
        showWeatherCards();

        // Display Current Weather
        const currentWeather = data.current;
        const { description: currentDesc, icon: currentIconCode } = getWeatherDescriptionAndIcon(currentWeather.weather_code);
        
        locationNameEl.textContent = displayName;
        currentDateEl.textContent = new Date(currentWeather.time).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
        currentIconEl.textContent = currentIconCode;
        currentTempEl.textContent = `${Math.round(currentWeather.temperature_2m)}°C`;
        currentConditionEl.textContent = currentDesc;
        currentFeelsLikeEl.textContent = `${Math.round(currentWeather.apparent_temperature)}°C`;
        currentHumidityEl.textContent = `${currentWeather.relative_humidity_2m}%`;
        currentWindEl.textContent = `${Math.round(currentWeather.wind_speed_10m)} km/h`;

        // Display Hourly Forecast
        hourlyForecastScrollerEl.innerHTML = ''; // Clear previous forecast
        const now = new Date();
        const currentHour = now.getHours();

        // Find the index of the current hour in the forecast data
        let startIndex = data.hourly.time.findIndex(timeISO => new Date(timeISO).getHours() === currentHour);
        if (startIndex === -1) startIndex = 0; // Fallback if current hour not found

        // Display next 24 hours from the current hour
        for (let i = 0; i < 24; i++) {
            const forecastIndex = (startIndex + i) % data.hourly.time.length; // Wrap around if needed, though we only fetch 1 day
            if (forecastIndex >= data.hourly.time.length) break; // Ensure we don't go out of bounds

            const timeISO = data.hourly.time[forecastIndex];
            const dateObj = new Date(timeISO);
            
            // Skip past hours for today
            if (dateObj < now && dateObj.toDateString() === now.toDateString() && i < (24 - currentHour) ) {
                 if (dateObj.getHours() < currentHour) continue;
            }


            const temp = data.hourly.temperature_2m[forecastIndex];
            const weatherCode = data.hourly.weather_code[forecastIndex];
            const { description: hourlyDesc, icon: hourlyIconCode } = getWeatherDescriptionAndIcon(weatherCode);

            const hourlyItem = document.createElement('div');
            hourlyItem.classList.add('hourly-item');
            hourlyItem.innerHTML = `
                <p class="time">${dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}</p>
                <span class="weather-icon">${hourlyIconCode}</span>
                <p class="temp">${Math.round(temp)}°C</p>
                <p class="condition-text" style="font-size:0.7em; opacity:0.8;">${hourlyDesc.split(' ')[0]}</p>
            `;
            hourlyForecastScrollerEl.appendChild(hourlyItem);
        }
    }

    function getWeatherDescriptionAndIcon(code) {
        // WMO Weather interpretation codes
        const descriptions = {
            0: { description: "Clear sky", icon: "☀️" },
            1: { description: "Mainly clear", icon: "🌤️" },
            2: { description: "Partly cloudy", icon: "🌥️" },
            3: { description: "Overcast", icon: "☁️" },
            45: { description: "Fog", icon: "🌫️" },
            48: { description: "Depositing rime fog", icon: "🌫️" },
            51: { description: "Light drizzle", icon: "🌦️" },
            53: { description: "Moderate drizzle", icon: "🌦️" },
            55: { description: "Dense drizzle", icon: "🌧️" },
            56: { description: "Light freezing drizzle", icon: "🌨️" },
            57: { description: "Dense freezing drizzle", icon: "🌨️" },
            61: { description: "Slight rain", icon: "🌦️" },
            63: { description: "Moderate rain", icon: "🌧️" },
            65: { description: "Heavy rain", icon: "🌧️" },
            66: { description: "Light freezing rain", icon: "🌨️" },
            67: { description: "Heavy freezing rain", icon: "🌨️" },
            71: { description: "Slight snow fall", icon: "🌨️" },
            73: { description: "Moderate snow fall", icon: "❄️" },
            75: { description: "Heavy snow fall", icon: "❄️" },
            77: { description: "Snow grains", icon: "🌨️" },
            80: { description: "Slight rain showers", icon: "🌦️" },
            81: { description: "Moderate rain showers", icon: "🌧️" },
            82: { description: "Violent rain showers", icon: "🌧️" },
            85: { description: "Slight snow showers", icon: "🌨️" },
            86: { description: "Heavy snow showers", icon: "❄️" },
            95: { description: "Thunderstorm", icon: "⛈️" },
            96: { description: "Thunderstorm with slight hail", icon: "⛈️" },
            99: { description: "Thunderstorm with heavy hail", icon: "⛈️" },
        };
        return descriptions[code] || { description: "Unknown", icon: "❓" };
    }

    function showLoading(isLoading) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function showError(message) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        hideWeatherCards();
    }

    function hideError() {
        errorDisplay.style.display = 'none';
    }
    
    function showWeatherCards() {
        if (currentWeatherCard) currentWeatherCard.style.display = 'block';
        if (hourlyForecastCard) hourlyForecastCard.style.display = 'block';
    }

    function hideWeatherCards() {
        if (currentWeatherCard) currentWeatherCard.style.display = 'none';
        if (hourlyForecastCard) hourlyForecastCard.style.display = 'none';
    }

    // Initial load for a default location (e.g., London)
    fetchWeatherData("Visakhapatnam");
});
