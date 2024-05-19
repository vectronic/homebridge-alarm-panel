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
const LOGIC_CONTEXT = 'ALARM_PANEL_LOGIC';
const JSON_CONTENT = {'Content-Type': 'application/json'};

let Service;
let Characteristic;

const TARGET_AWAY_ARM = "TARGET_AWAY_ARM";
const TARGET_HOME_ARM = "TARGET_HOME_ARM";
const TARGET_NIGHT_ARM = "TARGET_NIGHT_ARM";
const TARGET_DISARM = "TARGET_DISARM";

const CURRENT_AWAY_ARMED = "CURRENT_AWAY_ARMED";
const CURRENT_HOME_ARMED = "CURRENT_HOME_ARMED";
const CURRENT_NIGHT_ARMED = "CURRENT_NIGHT_ARMED";
const CURRENT_DISARMED = "CURRENT_DISARMED";
const CURRENT_ALARM_TRIGGERED = "CURRENT_ALARM_TRIGGERED";


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

        let previousTargetState = this.alarmPanelAccessory.targetState;
        const newTargetState = request.body.targetState;
        this.log(`previousTargetState: ${previousTargetState} => newTargetState: ${newTargetState}`);

        if (previousTargetState !== newTargetState) {
            this.alarmPanelAccessory.securitySystemService
                .getCharacteristic(Characteristic.SecuritySystemTargetState)
                .setValue(getHomekitTargetStateFromLocalTargetState(newTargetState), undefined, WEB_UI_CONTEXT);
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


function getLocalCurrentStateFromHomekitCurrentState(homekitCurrentState) {
    switch (homekitCurrentState) {
        case Characteristic.SecuritySystemCurrentState.AWAY_ARM:
            return CURRENT_AWAY_ARMED;
        case Characteristic.SecuritySystemCurrentState.STAY_ARM:
            return CURRENT_HOME_ARMED;
        case Characteristic.SecuritySystemCurrentState.NIGHT_ARM:
            return CURRENT_NIGHT_ARMED;
        case Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED:
            return CURRENT_ALARM_TRIGGERED;
        default:
            return CURRENT_DISARMED;
    }
}


function getLocalTargetStateFromHomekitTargetState(homekitTargetState) {
    switch (homekitTargetState) {
        case Characteristic.SecuritySystemTargetState.AWAY_ARM:
            return TARGET_AWAY_ARM;
        case Characteristic.SecuritySystemTargetState.STAY_ARM:
            return TARGET_HOME_ARM;
        case Characteristic.SecuritySystemTargetState.NIGHT_ARM:
            return TARGET_NIGHT_ARM;
        default:
            return TARGET_DISARM;
    }
}


function getHomekitCurrentStateFromLocalCurrentState(localCurrentState) {
    switch (localCurrentState) {
        case CURRENT_AWAY_ARMED:
            return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
        case CURRENT_HOME_ARMED:
            return Characteristic.SecuritySystemCurrentState.STAY_ARM;
        case CURRENT_NIGHT_ARMED:
            return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
        case CURRENT_ALARM_TRIGGERED:
            return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;
        default:
            return Characteristic.SecuritySystemCurrentState.DISARMED;
    }
}


function getHomekitTargetStateFromLocalTargetState(localTargetState) {
    switch (localTargetState) {
        case TARGET_AWAY_ARM:
            return Characteristic.SecuritySystemTargetState.AWAY_ARM;
        case TARGET_HOME_ARM:
            return Characteristic.SecuritySystemTargetState.STAY_ARM;
        case TARGET_NIGHT_ARM:
            return Characteristic.SecuritySystemTargetState.NIGHT_ARM;
        default:
            return Characteristic.SecuritySystemTargetState.DISARM;
    }
}


/**
 * Accessory "AlarmPanel"
 */

function AlarmPanelAccessory(log, config) {

    this.log = log;

    this.name = 'Alarm Panel';

    this.awayArmDelay = config.away_arm_delay || 30;
    this.alarmDelay = config.alarm_delay || 30;

    this.current = CURRENT_DISARMED;
    this.target = TARGET_DISARM;
    this.arming = false;
    this.tripped = false;

    this.awayArmedTimeout = null;
    this.alarmingTimeout = null;

    this.arming_tone_webhook_url = config['arming_tone_webhook_url'] || config['sonos_http_arming_tone_api_url'];
    this.tripped_tone_webhook_url = config['tripped_tone_webhook_url'] || config['sonos_http_tripped_tone_api_url'];
    this.alarming_tone_webhook_url = config['alarming_tone_webhook_url'] || config['sonos_http_alarming_tone_api_url'];
    this.armingToneInterval = config['arming_tone_interval'] || 3;
    this.trippedToneInterval = config['tripped_tone_interval'] || 1;
    this.alarmingToneInterval = config['alarming_tone_interval'] || 1;

    this.securitySystemService = new Service.SecuritySystem('Alarm System', 'alarm');
    this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemTargetState)
        .on('get', this.getTarget.bind(this))
        .on('set', this.setTarget.bind(this));

    this.securitySystemService
        .getCharacteristic(Characteristic.SecuritySystemCurrentState)
        .on('get', this.getCurrent.bind(this));

    this.trippedService = new Service.Switch('Tripped', 'tripped');
    this.trippedService.getCharacteristic(Characteristic.On)
        .on('get', this.getTripped.bind(this))
        .on('set', this.setTripped.bind(this));

    this.armingService = new Service.ContactSensor('Arming', 'arming');
    this.armingService.getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getArming.bind(this));

    this.accessoryInformationService = new Service.AccessoryInformation();
    this.accessoryInformationService.setCharacteristic(Characteristic.Manufacturer, "vectronic");
    this.accessoryInformationService.setCharacteristic(Characteristic.Model, "Alarm Panel");

    if (this.arming_tone_webhook_url !== undefined) {
        this.startArmingToneStateTimeout();
    }

    if (this.tripped_tone_webhook_url !== undefined) {
        this.startTrippedToneStateTimeout();
    }

    if (this.alarming_tone_webhook_url !== undefined) {
        this.startAlarmingToneStateTimeout();
    }
}


AlarmPanelAccessory.prototype.startArmingToneStateTimeout = function() {

    this.armingToneTimeout = setTimeout((function() {

        if (this.arming) {
            const that = this;
            request(this.arming_tone_webhook_url, function (error) {
                if (error) {
                    that.log(`armingToneTimeout: ${error}`)
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

        if (this.tripped) {
            const that = this;
            request(this.tripped_tone_webhook_url, function (error) {
                if (error) {
                    that.log(`trippedToneTimeout: ${error}`)
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

        if (this.current === CURRENT_ALARM_TRIGGERED) {
            const that = this;
            request(this.alarming_tone_webhook_url, function (error) {
                if (error) {
                    that.log(`alarmingToneTimeout: ${error}`)
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
        currentState: this.current,
        targetState: this.target,
        arming: this.arming,
        tripped: this.tripped
    };
};


AlarmPanelAccessory.prototype.getCurrent = function(callback, context) {
    this.log(`Getting current state: ${this.current}${getContextMessage(context)}`);
    callback(null, getHomekitCurrentStateFromLocalCurrentState(this.current));
};


AlarmPanelAccessory.prototype.getTarget = function(callback, context) {
    this.log(`Getting target state: ${this.target}${getContextMessage(context)}`);
    callback(null, getHomekitTargetStateFromLocalTargetState(this.target));
};


AlarmPanelAccessory.prototype.getTripped = function(callback, context) {
    this.log(`Getting current value of Tripped: ${this.tripped}${getContextMessage(context)}`);
    callback(null, this.tripped);
};


AlarmPanelAccessory.prototype.getArming = function(callback, context) {
    this.log(`Getting current value of Arming: ${this.arming}${getContextMessage(context)}`);
    callback(null, this.arming ? 1 : 0);
};


AlarmPanelAccessory.prototype.setTarget = function(target, callback, context) {

    target = getLocalTargetStateFromHomekitTargetState(target);

    this.log(`Setting target state to: ${target}${getContextMessage(context)}`);

    // if no state change, nothing to do
    if (this.target === target) {
        callback();
        return;
    }

    if (target === TARGET_AWAY_ARM) {

        this.arming = true;
        this.armingService.getCharacteristic(Characteristic.ContactSensorState).updateValue(1);

        // Set timeout to transition to away armed
        this.awayArmedTimeout = setTimeout((function() {
            this.log('Away armed timeout expired!');

            // prevent race conditions
            if (this.target !== TARGET_AWAY_ARM) {
                this.log('Ignoring Away Armed Timeout as target is not TARGET_AWAY_ARM!');
            }
            else {
                this.current = CURRENT_AWAY_ARMED;
                this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(getHomekitCurrentStateFromLocalCurrentState(CURRENT_AWAY_ARMED));
                this.arming = false;
                this.armingService.getCharacteristic(Characteristic.ContactSensorState).updateValue(0);
            }
        }).bind(this), this.awayArmDelay * 1000);

        // Do this to not prevent homebridge shutdown
        this.awayArmedTimeout.unref();
        this.log('Away armed timeout set...');
    }
    else if (target === TARGET_HOME_ARM) {
        this.current = CURRENT_HOME_ARMED;
        this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue(getHomekitCurrentStateFromLocalCurrentState(CURRENT_HOME_ARMED));
        this.arming = false;
        this.armingService.getCharacteristic(Characteristic.ContactSensorState).updateValue(0);
        if (this.awayArmedTimeout) {
            clearTimeout(this.awayArmedTimeout);
            this.log('Disarm: away armed timeout cleared...');
        }
    }
    else if (target === TARGET_NIGHT_ARM) {
        this.current = CURRENT_NIGHT_ARMED;
        this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue(getHomekitCurrentStateFromLocalCurrentState(CURRENT_NIGHT_ARMED));
        this.arming = false;
        this.armingService.getCharacteristic(Characteristic.ContactSensorState).updateValue(0);
        if (this.awayArmedTimeout) {
            clearTimeout(this.awayArmedTimeout);
            this.log('Disarm: away armed timeout cleared...');
        }
    }
    else {
        // Clear any timeouts

        if (this.awayArmedTimeout) {
            clearTimeout(this.awayArmedTimeout);
            this.log('Disarm: away armed timeout cleared...');
        }

        if (this.alarmingTimeout) {
            clearTimeout(this.alarmingTimeout);
            this.log('Disarm: alarming timeout cleared...');
        }

        // Clear armed, triggered and arming states

        this.target = TARGET_DISARM;
        this.current = CURRENT_DISARMED;
        this.arming = false;
        this.tripped = false;

        this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .updateValue(getHomekitCurrentStateFromLocalCurrentState(CURRENT_DISARMED));
        this.armingService.getCharacteristic(Characteristic.ContactSensorState).setValue(0);
        this.trippedService.getCharacteristic(Characteristic.On).updateValue(false);
    }

    // save state
    this.target = target;

    callback();
};


AlarmPanelAccessory.prototype.rejectTripped = function(tripped) {

    this.ignoreTimeout = setTimeout((function() {
        this.log(`Ignore state timeout expired! Updating tripped service to: ${tripped}`);
        this.trippedService.getCharacteristic(Characteristic.On).updateValue(tripped, null, LOGIC_CONTEXT);
    }).bind(this), 500);
    this.ignoreTimeout.unref();
    this.log('Ignore state timeout set...');
};


AlarmPanelAccessory.prototype.setTripped = function(tripped, callback, context) {
    this.log(`Requested to set current value of Tripped to: ${tripped}${getContextMessage(context)}`);

    // if no state change, nothing to do
    if (this.tripped === tripped) {
        callback();
        return;
    }

    if (tripped) {

        if ((this.current === CURRENT_DISARMED) || (this.current === CURRENT_ALARM_TRIGGERED)) {
            this.log('State is CURRENT_DISARMED or CURRENT_ALARM_TRIGGERED, ignoring request to set tripped to true...');
            callback();
            this.rejectTripped(this.tripped);
            return;
        }

        // Set timeout to transition to alarming
        this.alarmingTimeout = setTimeout((function () {
            this.log('Alarming timeout expired!');

            // prevent race conditions - not sure if needed but feels safer
            if (this.current === CURRENT_DISARMED) {
                this.log('Ignoring Alarming Timeout as state is CURRENT_DISARMED!');
            }
            else if (this.current === CURRENT_ALARM_TRIGGERED) {
                this.log('Ignoring Alarming Timeout as state is CURRENT_ALARM_TRIGGERED!');
            }
            else if (!this.tripped) {
                this.log('Ignoring Alarming Timeout as Tripped is false!');
            }
            else {
                this.tripped = false;
                this.current = CURRENT_ALARM_TRIGGERED;
                this.trippedService.getCharacteristic(Characteristic.On).updateValue(false);
                this.securitySystemService.getCharacteristic(Characteristic.SecuritySystemCurrentState)
                    .updateValue(getHomekitCurrentStateFromLocalCurrentState(CURRENT_ALARM_TRIGGERED));
            }
        }).bind(this), this.alarmDelay * 1000);

        // Do this to not prevent homebridge shutdown
        this.alarmingTimeout.unref();
        this.log('Alarming timeout set...');
    }
    else {
        if (context !== LOGIC_CONTEXT) {
            this.log(`Ignoring request to manually set tripped to false...`);
            callback();
            this.rejectTripped(this.tripped);
            return;
        }

        if (this.alarmingTimeout) {
            clearTimeout(this.alarmingTimeout);
            this.log('Alarming timeout cleared...');
        }
    }
    this.tripped = tripped;
    callback();
};


AlarmPanelAccessory.prototype.getServices = function() {

    this.log('getServices');

    return [
        this.accessoryInformationService,
        this.securitySystemService,
        this.trippedService,
        this.armingService
    ];
};


module.exports = function(homebridge) {

    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerPlatform("homebridge-alarm-panel", "AlarmPanel", AlarmPanelPlatform);
};
