import './style.css'

// Entry point. The game bootstraps here once the engine modules land.
const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing #app mount point')
