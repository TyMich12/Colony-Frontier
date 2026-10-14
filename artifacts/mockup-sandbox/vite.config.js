import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin";
export default defineConfig({
    plugins: [
        mockupPreviewPlugin(),
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
        },
    },
    root: path.resolve(import.meta.dirname),
    build: {
        outDir: path.resolve(import.meta.dirname, "dist"),
        emptyOutDir: true,
    },
    server: {
        host: "0.0.0.0",
        port: 5173,
        allowedHosts: true,
        proxy: {
            "/simulate": {
                target: "http://127.0.0.1:8080",
                changeOrigin: true,
            },
            "/mission-survival": {
                target: "http://127.0.0.1:8080",
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: "0.0.0.0",
        port: 4173,
        allowedHosts: true,
    },
});
