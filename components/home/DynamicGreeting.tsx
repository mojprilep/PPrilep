"use client";

import { useEffect, useMemo, useState } from "react";
import { useViewer } from "../../lib/useViewer";

type Props = {
  fallbackName: string;
};

type DailyForecast = {
  date: string;
  max: number;
  min: number;
  code: number;
  rainProbability: number;
};

type WeatherData = {
  temp: number;
  max: number;
  min: number;
  code: number;
  rainProbability: number;
  daily: DailyForecast[];
};

const WEEKDAYS_MK = ["Нед", "Пон", "Вто", "Сре", "Чет", "Пет", "Саб"];

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Денес";
  if (index === 1) return "Утре";
  const d = new Date(dateStr + "T00:00:00");
  return WEEKDAYS_MK[d.getDay()] ?? dateStr;
}

const PRILEP_CENTER = { lat: 41.3451, lon: 21.555 };

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Добро утро";
  if (hour < 18) return "Добар ден";
  return "Добра вечер";
}

function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(code)) return "🌦️";
  if ([61, 63, 65, 66, 67].includes(code)) return "🌧️";
  if ([71, 73, 75, 77].includes(code)) return "❄️";
  if ([80, 81, 82].includes(code)) return "⛈️";
  if ([95, 96, 99].includes(code)) return "🌩️";
  return "🌡️";
}

export default function DynamicGreeting({ fallbackName }: Props) {
  // The name fills in after hydration so the page can stay cached.
  const { firstName } = useViewer();
  const placeLabel = firstName ?? (fallbackName || "Прилеп");
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      try {
        const url =
          `https://api.open-meteo.com/v1/forecast?latitude=${PRILEP_CENTER.lat}&longitude=${PRILEP_CENTER.lon}` +
          "&current=temperature_2m,weather_code" +
          "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
          "&forecast_days=3&timezone=auto";

        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        if (cancelled) return;

        const times: string[] = data?.daily?.time ?? [];
        const daily: DailyForecast[] = times.map((date, i) => ({
          date,
          max: Math.round(data?.daily?.temperature_2m_max?.[i] ?? 0),
          min: Math.round(data?.daily?.temperature_2m_min?.[i] ?? 0),
          code: Number(data?.daily?.weather_code?.[i] ?? 0),
          rainProbability: Math.round(
            data?.daily?.precipitation_probability_max?.[i] ?? 0,
          ),
        }));

        setWeather({
          temp: Math.round(data?.current?.temperature_2m ?? 0),
          max: Math.round(data?.daily?.temperature_2m_max?.[0] ?? 0),
          min: Math.round(data?.daily?.temperature_2m_min?.[0] ?? 0),
          code: Number(data?.current?.weather_code ?? 0),
          rainProbability: Math.round(
            data?.daily?.precipitation_probability_max?.[0] ?? 0,
          ),
          daily,
        });
      } catch {
        // Silent fallback: greeting still renders even without weather.
      }
    }

    loadWeather();
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting = useMemo(() => getTimeGreeting(), []);

  return (
    <div className="w-full">
      <div className="w-full">
        <h1 className="text-4xl font-semibold leading-[1.02] tracking-tight text-theme-heading">
          {greeting}, {placeLabel}.
        </h1>

        {weather && weather.daily.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {weather.daily.map((day, i) => (
              <div
                key={day.date}
                className="flex flex-col items-center gap-0.5 rounded-lg border border-theme bg-theme-surface px-3 py-2">
                <span className="text-xs font-semibold text-theme-muted">
                  {dayLabel(day.date, i)}
                </span>
                <span className="text-lg leading-none">{weatherIcon(day.code)}</span>
                <span className="text-xs font-medium text-theme-heading">
                  {day.max}° <span className="text-theme-subtle">/ {day.min}°</span>
                </span>
                <span className="text-[10px] text-theme-subtle">
                  🌧️ {day.rainProbability}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
