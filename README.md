# Pizzaverse

This project visualizes pizza and wine pairings using WebGL.

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or later

## Install dependencies

Run the following command from the project root:

```bash
npm install
```

## Lint the code

Use `npm run lint` to run ESLint on all JavaScript files under `docs/` and `wine_pizza_cosmos/`.

```bash
npm run lint
```

## Run the visualization

Serve the files in the `docs/` directory with any static file server and open `index.html` in your browser. One simple option using Python is:

```bash
python3 -m http.server 8000 --directory docs
```

Then visit <http://localhost:8000> to view the interactive cosmos.
