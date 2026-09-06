import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './plugins/i18n'
import { Vue3OrgChartPlugin } from 'vue3-org-chart'
import { useAuthStore } from './stores/auth'
import './assets/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.use(Vue3OrgChartPlugin)

// Restore the session (if a valid JWT is in localStorage) before installing
// the router — router install triggers its first navigation immediately,
// and that navigation's guard needs isLoggedIn already resolved or it
// bounces an already-authenticated user back to /login (and nothing
// re-triggers navigation once restoreSession resolves afterwards).
await useAuthStore().restoreSession()

app.use(router)
app.mount('#app')
