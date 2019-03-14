# homebridge-alarm-panel
> A [Homebridge](https://github.com/nfarina/homebridge) plugin providing an alarm system with a web UI. 

### Aim

Provides a web UI alarm panel to view and manage a HomeKit based alarm system.

Using on a spare mobile device which has been position near an entrance door
it can act as a secure (fingerprint or passcode protected)
alarm control panel.

The web UI provides:
 
* home/away mode control
* arming, tripped and alerting states with visual and audio indication 

You can use other HomeKit/Homebridge accessories and HomeKit automation to set the tripped state 
(e.g. via an entry detector changing state) and to alert you in the alarming state 
(e.g. via an SMS notification). 

### Installation

1. Install homebridge using: `npm install -g homebridge`
1. Install this plugin using: `npm install -g homebridge-alarm-panel`
1. Update your configuration file. See `sample-config.json` snippet below.

### Configuration

Example `config.json` entry:

```
"platforms": [
  {
    "platform": "AlarmPanel",
    "web_ui_port": "8888"
  }
]
```

### Integration

The platform provides one accessory which exposes an *Alarm Panel* service with the following Characteristics:

* *Armed Mode*: *Home* or *Away*
* *Alarm State*: *Off*, *Arming*, *Armed*, *Tripped*, *Alerting*

You should integrate these via HomeKit automation rules so that:
 
- The *Alarm State* is set to *Tripped* if entry is detected ONLY IF the current *Alarm State* is *Armed*.
- You are notified when the *Alarm State* is set to *Alerting* 
    (e.g. send an SMS using [homebridge-twilio-sms](https://www.npmjs.com/package/homebridge-twilio-sms)) 

##### HTTP REST API

The plugin provides a simple HTTP REST API which is used by the web UI.

The current Armed Mode can be queried by performing a GET of:

`http://yourHomebridgeServerIp:web_ui_port/api/armedMode`

This will return a response with content type `application/json` with the body content in the form:

    {
        "armedMode": "<HOME|AWAY>"
    }

The Armed Mode can be updated by performing a POST to:

`http://yourHomebridgeServerIp:web_ui_port/api/armedMode`

with the body content in the form:

    {
        "armedMode": "<HOME|AWAY>"
    }
    
This will return a response with content type `application/json` with the body content in the form:

    {
        "armedMode": "<HOME|AWAY>"
    }

The current Alarm State can be queried by performing a GET of:

`http://yourHomebridgeServerIp:web_ui_port/api/alarmState`

This will return a response with content type `application/json` with the body content in the form:

    {
        "alarmState": "<OFF|ARMING|ARMED|TRIPPED|ALARMING>"
    }

### Usage
 
Open the following URL in your mobile browser: [http://yourHomebridgeServerIp:web_ui_port](http://yourHomebridgeServerIp:web_ui_port)

When the *Armed Armed* is set to *Away* (via the Home app or the alarm panel web UI) the *Alarm State* will automatically
transition to *Arming* and a visible and audible cue will occur.

The *Armed State* will transition automatically to *Armed* after 60 seconds (allowing you time to depart).

When HomeKit automation transitions the *Alarm State* to *Tripped* (due to entry detection), 
a visible and audible cue will occur.

If the *Armed Mode* is not set to *Home* within 60 seconds, the *Alarm State* will transition from *Tripped* to *Alerting*
and a visible and audible cue will occur.
