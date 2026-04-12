import { timeUtils } from './js/helpers/time-utils.js';
import { domUtils } from './js/helpers/dom-utils.js';
import { uiUtils } from './js/helpers/ui-utils.js';
import { miscUtils } from './js/helpers/misc-utils.js';

export class PopupHelpers {}

Object.assign(PopupHelpers, timeUtils, domUtils, uiUtils, miscUtils);

window.PopupHelpers = PopupHelpers;
