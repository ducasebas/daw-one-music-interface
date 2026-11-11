import {tr} from "../shared/i18n.js";
import React, { useState } from "react";
import {
  presets,
  tokenSchema,
  normalizeThemePreferences,
  saveCustomTheme,
} from "../shared/themes.js";
export function ThemeSettings({ preferences, theme, onChange, section }) {
  const [name, setName] = useState("My DAW ONE"),
    [message, setMessage] = useState("");
  const all = [...presets, ...preferences.custom],
    change = (patch) =>
      onChange(normalizeThemePreferences({ ...preferences, ...patch }));
  const choose = (key, label) => (
    <label key={key}>
      {tr(label)}
      <select
        aria-label={tr(label)}
        value={preferences[key]}
        onChange={(e) =>
          change({
            [key]: e.target.value,
            ...(key === "selected" && e.target.value === "nerd-mode"
              ? { diagnosticPalette: theme.tokens }
              : {}),
            ...(key === "selected" ? { mode: "manual" } : {}),
          })
        }
      >
        {preferences.draft && key === "selected" && (
          <option value="draft">{tr("Custom preview")}</option>
        )}
        {all.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
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
  const groups = {
    Palette: ["background", "surface", "text", "muted"],
    Accents: ["accent", "borderColor", "glowColor", "meterColor"],
    Typography: ["font", "spacing"],
    Finish: ["panelOpacity", "radius", "borderWidth", "glow", "meter"],
  };
  return (
    <section className="theme-page" aria-label={tr("Theme engine")}>
      <div className="theme-reason" role="status">{tr("Active: ")}{tr(theme.name)} · {tr(theme.reason)}
        {tr(section === "Schedule"
          ? " · Browser local time; equal hours: night all day"
          : "")}
      </div>
      {section === "Skins" ? (
        <div className="control-grid">
          {tr(choose("selected", "Skin"))}
          <p>{tr("Choose a skin. Customize it on Palette, Accents, Typography and Finish; save your version on Save theme.")}</p>
        </div>
      ) : groups[section] ? (
        <div
          className={`control-grid tokens-grid count-${groups[section].length}`}
        >
          {groups[section].map((key) => {
            const schema = tokenSchema[key];
            return (
              <label key={key}>
                {tr(schema.label)}
                {schema.type === "enum" ? (
                  <select
                    aria-label={tr(schema.label)}
                    value={theme.tokens[key]}
                    onChange={(e) => token(key, e.target.value)}
                  >
                    {schema.values.map((v) => (
                      <option key={v}>{tr(v)}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={tr(schema.label)}
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
            );
          })}
        </div>
      ) : section === "Automation" ? (
        <div className="control-grid">
          <label>{tr("Automatic switching")}<select
              aria-label={tr("Automatic switching")}
              value={preferences.mode}
              onChange={(e) => change({ mode: e.target.value })}
            >
              <option value="manual">{tr("Manual")}</option>
              <option value="schedule">{tr("Day / night schedule")}</option>
              <option value="state">{tr("Device state")}</option>
            </select>
          </label>
          <p>{tr("Configure day/night on Schedule and state choices on State mapping. Fault → offline → standby → playback. Safety is unaffected.")}</p>
        </div>
      ) : section === "Schedule" ? (
        <div className="control-grid">
          {tr(choose("day", "Day skin"))}
          {tr(choose("night", "Night skin"))}
          {[
            ["dayStart", "Day begins (hour)"],
            ["nightStart", "Night begins (hour)"],
          ].map(([key, label]) => (
            <label key={key}>
              {tr(label)}
              <input
                aria-label={tr(label)}
                type="number"
                min="0"
                max="23"
                value={preferences[key]}
                onChange={(e) => change({ [key]: +e.target.value })}
              />
            </label>
          ))}
        </div>
      ) : section === "State mapping" ? (
        <div className="control-grid">
          {Object.entries(preferences.stateThemes).map(([state, id]) => (
            <label key={state}>{tr("Skin when ")}{tr(state)}
              <select
                aria-label={tr(`Skin when ${state}`)}
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
      ) : (
        <div className="control-grid">
          <label>{tr("Custom theme name")}<input
              aria-label={tr("Custom theme name")}
              value={name}
              maxLength="48"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button onClick={save}>{tr("Save custom theme")}</button>
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
              >{tr("Delete custom theme")}</button>
            )}
          </div>
          <p role="status">
            {tr(message || "Saved on this browser. Works offline.")}
          </p>
        </div>
      )}
    </section>
  );
}
