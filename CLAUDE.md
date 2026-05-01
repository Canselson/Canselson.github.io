# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is a static GitHub Pages site for the Southampton Spitfires, served at `southamptonspitfires.me` (configured via `CNAME`). There is no build step, bundler, or framework — it is plain HTML/CSS/JS deployed directly from the `main` branch.

## Deployment

Changes pushed to `main` are automatically deployed by GitHub Pages. There is no CI pipeline or build process.

## Structure

- `index.html` — the single entry point; currently a bare-bones homepage
- `CNAME` — maps the custom domain `southamptonspitfires.me` to the GitHub Pages URL