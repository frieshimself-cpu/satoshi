import fs from "fs";
import path from "path";
import type { Candidate, Dossier } from "./types";

let candidatesCache: Candidate[] | null = null;
let dossiersCache: Dossier[] | null = null;

function readJson(file: string): any {
  const p = path.join(process.cwd(), "data", file);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function getCandidates(): Candidate[] {
  if (!candidatesCache) {
    candidatesCache = readJson("candidates.json").candidates as Candidate[];
  }
  return candidatesCache;
}

export function getDossiers(): Dossier[] {
  if (!dossiersCache) {
    dossiersCache = readJson("dossiers.json").dossiers as Dossier[];
  }
  return dossiersCache;
}

export const UNKNOWN_ID = "unknown";
export const UNKNOWN_FLOOR = 15;
