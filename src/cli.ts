#!/usr/bin/env node
// Placeholder entrypoint. Commands (init, scan, ...) arrive in T2.
const version = "0.1.0";
const arg = process.argv[2];

if (arg === "--version" || arg === "-v") {
  console.log(version);
} else {
  console.log(`levantate ${version}: resurrect your dead repos. Commands arrive in T2.`);
}
