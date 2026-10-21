// ==UserScript==
// @name         اغارات جماعي غزااوي
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Automates specific tasks on a webpage with random intervals between 5-10 minutes and reloads the page after 10-20 minutes.
// @author       الغزااوي
// @include        https://*/*=scavenge_mass*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function clickElement(selector, delay, callback) {
        const element = document.querySelector(selector);
        if (element) {
            element.click();
            if (callback) {
                setTimeout(callback, delay);
            }
        }
    }

    function runScript() {

        clickElement('a.quickbar_link[data-hash="7fc6bd63672584bfd117e31f2d84989e"]', 1000 + Math.random() * 2000, function() {
            let attempts = 0;
            const maxAttempts = 200;

            function clickMassButton() {
                const element = document.querySelector('#sendMass');

                    element.click();
                    attempts++;
                    console.log(`Clicked #sendMass ${attempts} time(s).`);
                    setTimeout(clickMassButton, 1000 + Math.random() * 1000);

            }

            clickMassButton();
        });
    }

    function getRandomInterval(minMinutes, maxMinutes) {

        return (Math.floor(Math.random() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60 * 1000;
    }

    function scheduleNextRun() {
        const interval = getRandomInterval(10, 20);
        console.log("الوقت المتبقي لتشغيل البرنامج: " + (interval / 6000) + " دقائق");
        setTimeout(() => {
            runScript();
            scheduleNextRun();
        }, interval);
    }

    function schedulePageReload() {
        const reloadInterval = getRandomInterval(1, 2);
        console.log("الوقت المتبقي لإعادة تحميل الصفحة: " + (reloadInterval / 6000) + " دقائق");
        setTimeout(() => {
            location.reload();
        }, reloadInterval);
    }


    runScript();
    scheduleNextRun();
    schedulePageReload();
})();




void(o);