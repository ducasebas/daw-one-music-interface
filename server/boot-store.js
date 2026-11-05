import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { bootSettings } from "../shared/boot.js";
export class BootStore {
  constructor(directory) {
    this.directory = directory;
  }
  load() {
    try {
      return bootSettings(
        JSON.parse(readFileSync(join(this.directory, "boot.json"), "utf8")),
      );
    } catch {
      return bootSettings();
    }
  }
  save(input) {
    const settings = bootSettings(input);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, "boot.json");
    writeFileSync(path + ".tmp", JSON.stringify(settings) + "\n", {
      mode: 0o600,
    });
    renameSync(path + ".tmp", path);
    return settings;
  }
}
