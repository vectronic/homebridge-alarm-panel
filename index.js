'use strict';

const _ = require('lodash');
const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const serveStatic = require('serve-static');

const WEB_UI_CONTEXT = 'ALARM_PANEL_WEB_UI';
const TIMEOUT_CONTEXT = 'ALARM_PANEL_TIMEOUT';
const LOGIC_CONTEXT = 'ALARM_PANEL_LOGIC';
const JSON_CONTENT = {'Content-Type': 'application/json'};

let Service;
let Characteristic;

/**
 * Platform "AlarmPanel"
 */

function AlarmPanelPlatform(log, config) {

    this.log = log;
    this.config = config;

    this.webUiPort = config['web_ui_port'] || 8888;
    this.webUiPollInterval = config['web_ui_poll_interval'] || 2;
    this.webUiDebug = config['web_ui_debug'];
    this.web_ui_armingToneMp3Url = config['web_ui_arming_tone_mp3_url'];
    this.web_ui_trippedToneMp3Url = config['web_ui_tripped_tone_mp3_url'];
    this.web_ui_alarmingToneMp3Url = config['web_ui_alarming_tone_mp3_url'];

    this.armingToneInterval = config['arming_tone_interval'] || 3;
    this.trippedToneInterval = config['tripped_tone_interval'] || 1;
    this.alarmingToneInterval = config['alarming_tone_interval'] || 1;

    this.httpsKeyPath = config['https_key_path'];
    this.httpsCertPath = config['https_cert_path'];
}


AlarmPanelPlatform.prototype.getWebUiConfig = function() {
    return {
        web_ui_poll_interval: this.webUiPollInterval,
        web_ui_debug: this.webUiDebug,
        web_ui_arming_tone_mp3_url: this.web_ui_armingToneMp3Url,
        web_ui_tripped_tone_mp3_url: this.web_ui_trippedToneMp3Url,
        web_ui_alarming_tone_mp3_url: this.web_ui_alarmingToneMp3Url,
        arming_tone_interval: this.armingToneInterval,
        tripped_tone_interval: this.trippedToneInterval,
        alarming_tone_interval: this.alarmingToneInterval
    };
};


AlarmPanelPlatform.prototype.accessories = function(callback) {

    this.alarmPanelAccessory = new AlarmPanelAccessory(this.log, this.config);

    callback( [ this.alarmPanelAccessory ] );

    const app = express();

    app.use(serveStatic(path.join(__dirname, 'html')));

    const jsonParser = bodyParser.json();

    app.get('/api/state', (function(request, response) {

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify(this.alarmPanelAccessory.getState()));

        this.log(`get state: ${JSON.stringify(this.alarmPanelAccessory.getState())}`);

    }).bind(this));

    app.get('/api/config', (function(request, response) {

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify(this.getWebUiConfig()));

        this.log(`get config: ${JSON.stringify(this.getWebUiConfig())}`);

    }).bind(this));

    app.post('/api/state', jsonParser, (function(request, response) {

        let currentAwayState = this.alarmPanelAccessory.away;

        const newAwayState = request.body.away;
        this.log(`currentAwayState: ${currentAwayState} => newAwayState: ${newAwayState}`);

        if (currentAwayState !== newAwayState) {
            this.alarmPanelAccessory.awayService
                .getCharacteristic(Characteristic.On)
                .setValue(newAwayState, undefined, WEB_UI_CONTEXT);
        }

        response.writeHead(200, JSON_CONTENT);
        response.end(JSON.stringify(this.alarmPanelAccessory.getState()));

        this.log(`set state: ${JSON.stringify(this.alarmPanelAccessory.getState())}`);

    }).bind(this));

    if (this.httpsKeyPath && this.httpsCertPath) {
        const options = {
            key: fs.readFileSync(this.httpsKeyPath),
            cert: fs.readFileSync(this.httpsCertPath)
        };
        https.createServer(options, app).listen(this.webUiPort);
        this.log("Started HTTPS server for alarm-panel on port '%s'.", this.webUiPort);
    }
    else {
        app.listen(this.webUiPort);
        this.log("Started HTTP server for alarm-panel on port '%s'.", this.webUiPort);
    }
};


function getContextMessage(context) {
    if (_.isString(context)) {
        return ` via context: ${context}`;
    }
    return '';
}


/**
 * Accessory "AlarmPanel"
 */

function AlarmPanelAccessory(log, config) {

    this.log = log;

    this.name = 'Alarm Panel';

    this.armDelay = config.arm_delay || 30;
    this.alarmDelay = config.alarm_delay || 30;

    this.away = false;
    this.armed = false;
    this.tripped = false;
    this.alarming = false;

    this.armedTimeout = null;
    this.alarmingTimeout = null;

    this.sonos_http_arming_tone_api_url = config['sonos_http_arming_tone_api_url'];
    this.sonos_http_tripped_tone_api_url = config['sonos_http_tripped_tone_api_url'];
    this.sonos_http_alarming_tone_api_url = config['sonos_http_alarming_tone_api_url'];
    this.armingToneInterval = config['arming_tone_interval'] || 3;
    this.trippedToneInterval = config['tripped_tone_interval'] || 1;
    this.alarmingToneInterval = config['alarming_tone_interval'] || 1;

    this.awayService = new Service.Switch('Away', 'away');
    this.awayService.getCharacteristic(Characteristic.On)
        .on('get', this.getAway.bind(this))
        .on('set', this.setAway.bind(this));

    this.armedService = new Service.ContactSensor('Armed', 'armed');
    this.armedService.getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getArmed.bind(this));

    this.trippedService = new Service.Switch('Tripped', 'tripped');
    this.trippedService.getCharacteristic(Characteristic.On)
        .on('get', this.getTripped.bind(this))
        .on('set', this.setTripped.bind(this));

    this.alarmingService = new Service.ContactSensor('Alarming', 'alarming');
    this.alarmingService.getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getAlarming.bind(this));

    this.accessoryInformationService = new Service.AccessoryInformation();
    this.accessoryInformationService.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.accessoryInformationService.setCharacteristic(Characteristic.Model, "Alarm Panel");

    if (this.sonos_http_arming_tone_api_url !== undefined) {
        this.startArmingToneStateTimeout();
    }

    if (this.sonos_http_tripped_tone_api_url !== undefined) {
        this.startTrippedToneStateTimeout();
    }

    if (this.sonos_http_alarming_tone_api_url !== undefined) {
        this.startAlarmingToneStateTimeout();
    }
}


AlarmPanelAccessory.prototype.startArmingToneStateTimeout = function() {

    this.armingToneTimeout = setTimeout((function() {

        if (this.away && !this.armed) {
            const that = this;
            request(this.sonos_http_arming_tone_api_url, function (error) {
                if (error) {
                    this.log(`armingToneTimeout: ${error}`)
                }
                that.startArmingToneStateTimeout();
            });
        }
        else {
            this.startArmingToneStateTimeout();
        }
    }).bind(this), this.armingToneInterval * 1000);

    this.armingToneTimeout.unref();
};


AlarmPanelAccessory.prototype.startTrippedToneStateTimeout = function() {

    this.trippedToneTimeout = setTimeout((function() {

        if (this.tripped && !this.alarming) {
            const that = this;
            request(this.sonos_http_tripped_tone_api_url, function (error) {
                if (error) {
                    this.log(`trippedToneTimeout: ${error}`)
                }
                that.startTrippedToneStateTimeout();
            });
        }
        else {
            this.startTrippedToneStateTimeout();
        }
    }).bind(this), this.trippedToneInterval * 1000);

    this.trippedToneTimeout.unref();
};


AlarmPanelAccessory.prototype.startAlarmingToneStateTimeout = function() {

    this.alarmingToneTimeout = setTimeout((function() {

        if (this.alarming) {
            const that = this;
            request(this.sonos_http_alarming_tone_api_url, function (error) {
                if (error) {
                    this.log(`alarmingToneTimeout: ${error}`)
                }
                that.startAlarmingToneStateTimeout();
            });
        }
        else {
            this.startAlarmingToneStateTimeout();
        }
    }).bind(this), this.alarmingToneInterval * 1000);

    this.alarmingToneTimeout.unref();
};


AlarmPanelAccessory.prototype.getState = function() {

    return {
        away: this.away,
        armed: this.armed,
        tripped: this.tripped,
        alarming: this.alarming
    };
};


AlarmPanelAccessory.prototype.getAway = function(callback, context) {
    this.log(`Getting current value of Away: ${this.away}${getContextMessage(context)}`);
    callback(null, this.away);
};


AlarmPanelAccessory.prototype.setAway = function(away, callback, context) {
    this.log(`Setting current value of Away to: ${away}${getContextMessage(context)}`);

    // if newly no longer away
    if (this.away && !away) {

        // Clear any timeouts
        if (this.armedTimeout) {
            clearTimeout(this.armedTimeout);
            this.log('Home: armed timeout cleared...');
        }

        // Clear any timeouts
        if (this.alarmingTimeout) {
            clearTimeout(this.alarmingTimeout);
            this.log('Home: alarming timeout cleared...');
        }

        // Clear armed, triggered and alarming states

        this.armed = false;
        this.armedService.getCharacteristic(Characteristic.On).setValue(false, undefined, LOGIC_CONTEXT);

        this.tripped = false;
        this.trippedService.getCharacteristic(Characteristic.On).setValue(false, undefined, LOGIC_CONTEXT);

        this.alarming = false;
        this.alarmingService.getCharacteristic(Characteristic.On).setValue(false, undefined, LOGIC_CONTEXT);
    }

    // if newly away
    else if (!this.away && away) {

        // Set timeout to transition to armed
        this.armedTimeout = setTimeout((function() {
            this.log('Armed timeout expired!');

            // prevent race conditions
            if (!this.away) {
                this.log('Ignoring Armed Timeout as Away is false!');
            }
            else {
                this.armedService.getCharacteristic(Characteristic.On).setValue(true, undefined, TIMEOUT_CONTEXT);
            }
        }).bind(this), this.armDelay * 1000);

        // Do this to not prevent homebridge shutdown
        this.armedTimeout.unref();
        this.log('Armed timeout set...');
    }
    else {
    }

    // save state
    this.away = away;

    callback();
};


AlarmPanelAccessory.prototype.getArmed = function(callback, context) {
    this.log(`Getting current value of Armed: ${this.armed}${getContextMessage(context)}`);
    callback(null, this.armed);
};


AlarmPanelAccessory.prototype.getTripped = function(callback, context) {
    this.log(`Getting current value of Tripped: ${this.tripped}${getContextMessage(context)}`);
    callback(null, this.tripped);
};


AlarmPanelAccessory.prototype.setTripped = function(tripped, callback, context) {
    this.log(`Requested to set current value of Tripped to: ${tripped}${getContextMessage(context)}`);

    // if no state change, nothing to do
    if (this.tripped === tripped) {
        callback();
        return;
    }

    // if logic based
    if (context === LOGIC_CONTEXT) {

        // if tripped
        if (tripped) {
            if (!this.armed) {
                this.log('State is not armed, ignoring request to set tripped to true...');
                tripped = false;
                this.trippedService.getCharacteristic(Characteristic.On).updateValue(false, undefined, LOGIC_CONTEXT);
            }
        }
        // if untripped
        else {
            if (this.alarmingTimeout) {
                clearTimeout(this.alarmingTimeout);
                this.log('Alarming timeout cleared...');
            }
        }
    }
    // else if manual/automated
    else {

        // if tripped
        if (tripped) {
            if (!this.armed) {
                this.log('State is not armed, ignoring request to set tripped to true...');
                tripped = false;
                this.trippedService.getCharacteristic(Characteristic.On).updateValue(false, undefined, LOGIC_CONTEXT);
            }
            else {
                // Set timeout to transition to alarming
                this.alarmingTimeout = setTimeout((function() {
                    this.log('Alarming timeout expired!');

                    // prevent race conditions - not sure if needed but feels safer
                    if (!this.away) {
                        this.log('Ignoring Alarming Timeout as Away is false!');
                    }
                    else if (!this.armed) {
                        this.log('Ignoring Alarming Timeout as Armed is false!');
                    }
                    else if (!this.tripped) {
                        this.log('Ignoring Alarming Timeout as Tripped is false!');
                    }
                    else {
                        this.alarmingService.getCharacteristic(Characteristic.On).updateValue(true, undefined, TIMEOUT_CONTEXT);
                    }
                }).bind(this), this.alarmDelay * 1000);

                // Do this to not prevent homebridge shutdown
                this.alarmingTimeout.unref();
                this.log('Alarming timeout set...');
            }
        }
        // if untripped
        else {
            this.log(`Ignoring request to manually set tripped to false...`);
            tripped = true;
            this.trippedService.getCharacteristic(Characteristic.On).updateValue(true, undefined, LOGIC_CONTEXT);
        }
    }

    // save state
    this.tripped = tripped;

    callback();
};


AlarmPanelAccessory.prototype.getAlarming = function(callback, context) {
    this.log(`Getting current value of Alarming: ${this.alarming}${getContextMessage(context)}`);
    callback(null, this.alarming);
};


AlarmPanelAccessory.prototype.getServices = function() {

    this.log('getServices');

    return [
        this.accessoryInformationService,
        this.awayService,
        this.armedService,
        this.trippedService,
        this.alarmingService
    ];
};


module.exports = function(homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerPlatform("homebridge-alarm-panel", "AlarmPanel", AlarmPanelPlatform);
};
