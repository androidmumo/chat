import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { far } from '@fortawesome/free-regular-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(fas, far);

import App from './App.vue';
import './style.css';

const app = createApp(App);
app.use(ElementPlus);
app.component('fa', FontAwesomeIcon);
app.mount('#app');

