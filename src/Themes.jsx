import React, { useState } from "react";
import {
  presets,
  tokenSchema,
  normalizeThemePreferences,
  saveCustomTheme,
} from "../shared/themes.js";
export function ThemeSettings({ preferences, theme, onChange }) {
  const [name, setName] = useState("My DAW ONE"),
    [message, setMessage] = useState("");
  const all = [...presets, ...preferences.custom];
  const change = (patch) =>
    onChange(normalizeThemePreferences({ ...preferences, ...patch }));
  function token(key, value) {
    change({
      mode: "manual",
      selected: "draft",
      draft: {
        ...theme,
        id: "draft",
        name,
        tokens: { ...theme.tokens, [key]: value },
      },
    });
  }
  function save() {
    try {
      onChange(
        saveCustomTheme(
          preferences,
          { ...theme, name },
          `custom-${crypto.randomUUID()}`,
        ),
      );
      setMessage("Theme saved on this browser");
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <section className="theme-settings" aria-label="Theme engine">
      <h2>Appearance studio</h2>
      <p className="theme-reason" role="status">
        Active: {theme.name} · {theme.reason}
      </p>
      <div className="theme-grid">
        <label>
          Skin
          <select
            aria-label="Skin"
            value={preferences.selected}
            onChange={(e) =>
              change({ selected: e.target.value, mode: "manual" })
            }
          >
            {preferences.draft && <option value="draft">Custom preview</option>}
            {all.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Automatic switching
          <select
            aria-label="Automatic switching"
            value={preferences.mode}
            onChange={(e) => change({ mode: e.target.value })}
          >
            <option value="manual">Manual</option>
            <option value="schedule">Day / night schedule</option>
            <option value="state">Device state</option>
          </select>
        </label>
        {preferences.mode === "schedule" && (
          <>
            {[
              ["day", "Day skin"],
              ["night", "Night skin"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  aria-label={label}
                  value={preferences[key]}
                  onChange={(e) => change({ [key]: e.target.value })}
                >
                  {all.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {[
              ["dayStart", "Day begins (hour)"],
              ["nightStart", "Night begins (hour)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={preferences[key]}
                  onChange={(e) => change({ [key]: +e.target.value })}
                />
              </label>
            ))}
            <p>
              Uses this browser’s local time. Equal hours select night all day.
            </p>
          </>
        )}
        {preferences.mode === "state" &&
          Object.entries(preferences.stateThemes).map(([state, id]) => (
            <label key={state}>
              Skin when {state}
              <select
                aria-label={`Skin when ${state}`}
                value={id}
                onChange={(e) =>
                  change({
                    stateThemes: {
                      ...preferences.stateThemes,
                      [state]: e.target.value,
                    },
                  })
                }
              >
                {all.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
      </div>
      <details>
        <summary>Customize design tokens</summary>
        <div className="theme-grid">
          {Object.entries(tokenSchema).map(([key, schema]) => (
            <label key={key}>
              {schema.label}
              {schema.type === "enum" ? (
                <select
                  aria-label={schema.label}
                  value={theme.tokens[key]}
                  onChange={(e) => token(key, e.target.value)}
                >
                  {schema.values.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  aria-label={schema.label}
                  type={schema.type === "color" ? "color" : "number"}
                  min={schema.min}
                  max={schema.max}
                  step={schema.step}
                  value={theme.tokens[key]}
                  onChange={(e) =>
                    token(
                      key,
                      schema.type === "number"
                        ? +e.target.value
                        : e.target.value,
                    )
                  }
                />
              )}
            </label>
          ))}
        </div>
      </details>
      <div className="theme-save">
        <label>
          Custom theme name
          <input
            aria-label="Custom theme name"
            value={name}
            maxLength="48"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button onClick={save}>Save custom theme</button>
        {preferences.selected.startsWith("custom-") && (
          <button
            onClick={() =>
              change({
                custom: preferences.custom.filter(
                  (t) => t.id !== preferences.selected,
                ),
                selected: "reference-dark",
              })
            }
          >
            Delete custom theme
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      <p>
        Changes stay on this browser. Theme choice never changes safety
        behaviour. Fault warnings retain their safety color.
      </p>
    </section>
  );
}
