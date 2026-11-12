import test from "node:test";
import assert from "node:assert/strict";
import {
  clampVolume,
  linearVolume,
  knobVolume,
  rotateVolume,
  knobAngle,
  savedVolumeLimit,
  controlVolumeLimit,
} from "../shared/volume.js";
import {preferenceDefaults,validatePreferences} from '../shared/preferences.js';
import { settings } from "../shared/settings.js";
test("touch volume maps track positions with limits and bounds", () => {
  assert.equal(linearVolume(50, 0, 100), 50);
  assert.equal(linearVolume(200, 0, 100, 40), 40);
  assert.equal(clampVolume(-3), 0);
  assert.equal(linearVolume(-10, 0, 100), 0);
});
test("knob endpoints, dead zone and wrap never jump from max to zero", () => {
  assert.equal(knobVolume(-135), 0);
  assert.equal(knobVolume(0, 40), 20);
  assert.equal(knobVolume(135), 100);
  assert.equal(knobVolume(179), null);
  assert.ok(rotateVolume(95, 179, -179) > 95);
  assert.equal(rotateVolume(100, 179, -179), 100);
  assert.ok(rotateVolume(5, -179, 179) < 5);
  assert.equal(knobAngle(32, 0, { left: 0, top: 0, width: 64, height: 64 }), 0);
});
test("volume presentation setting is validated and survives serialization", () => {
  assert.equal(
    settings({ volumeControl: "circular" }).volumeControl,
    "circular",
  );
  assert.equal(
    settings(
      JSON.parse(JSON.stringify(settings({ volumeControl: "circular" }))),
    ).volumeControl,
    "circular",
  );
  assert.equal(settings({ volumeControl: "script" }).volumeControl, "linear");
});
test('only an explicitly saved ceiling can raise the installation limit; defaults and old preferences retain it',()=>{
 const initial=preferenceDefaults();
 assert.equal(savedVolumeLimit(initial,40),40);
 assert.equal(savedVolumeLimit({...initial,maxVolume:20},40),20);
 const saved=validatePreferences({...initial,maxVolume:65,prefs:{...initial.prefs,volumeLimitConfigured:true}});
 assert.equal(savedVolumeLimit(saved,40),65);
 assert.equal(savedVolumeLimit(validatePreferences(JSON.parse(JSON.stringify(saved))),40),65);
 assert.equal(controlVolumeLimit({mode:'music-assistant',musicAssistant:{volumeLimit:65},preferences:saved}),65);
 assert.equal(controlVolumeLimit({mode:'simulation',preferences:{maxVolume:30}}),30);
 assert.equal(savedVolumeLimit(preferenceDefaults(),40),40);
 assert.equal(validatePreferences({...initial,prefs:{volumeLimitConfigured:'yes'}}).prefs.volumeLimitConfigured,false);
 assert.equal(Object.hasOwn(saved,'maxVolumeConfigured'),false); // Keep the older top-level schema valid for rollback.
});
