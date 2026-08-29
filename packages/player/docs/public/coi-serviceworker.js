/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzguidmani/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request).then((response) => {
                if (response.status === 0) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
        );
    });
} else {
    (() => {
        const script = document.currentScript;
        if (!script) return;

        const path = script.src.replace(/\/coi-serviceworker\.js$/, "/");

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register(path + "coi-serviceworker.js").then(
                (registration) => {
                    registration.addEventListener("updatefound", () => {
                        window.location.reload();
                    });

                    if (registration.active && !navigator.serviceWorker.controller) {
                        window.location.reload();
                    }
                },
                (err) => {
                    console.error("COI Service Worker registration failed: ", err);
                }
            );
        }
    })();
}
