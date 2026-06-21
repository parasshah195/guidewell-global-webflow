import { setCurrentYear } from '$utils/current-year';

window.Webflow ||= [];
window.Webflow.push(() => {
  setCurrentYear();
});
