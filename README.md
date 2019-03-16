# homebridge-alarm-panel
> A [Homebridge](https://github.com/nfarina/homebridge) plugin providing an alarm system with a web UI. 

### Aim

Provides a web UI alarm panel to view and manage a HomeKit based alarm system.

Using on a spare mobile device which has been position near an entrance door it can act as a secure 
(fingerprint or passcode protected) alarm control panel.

The web UI provides:
 
* home/away mode control
* arming, armed, tripped and alerting states with visual and audio indication 

You can use other HomeKit/Homebridge accessories and HomeKit automation to:

* set the tripped state when any door or window is opened (e.g. via an entry detection accessory) if the alarm is armed.
* alert you in the alarming state (e.g. via an SMS notification accessory such as 
[homebridge-twilio-sms](https://www.npmjs.com/package/homebridge-twilio-sms)). 

### Installation

1. Install Homebridge using: `npm install -g homebridge`
1. Install this plugin using: `npm install -g homebridge-alarm-panel`
1. Update your configuration file. See `sample-config.json` snippet below.

### Configuration

Example `config.json` entry:

```
"platforms": [
  {
    "platform": "AlarmPanel",
    "web_ui_port": "8888",
    "name": "Alarm Panel",
    "arm_delay": 60,
    "alarm_delay": 60
  }
]
```

`arm_delay` is the delay in seconds after the *Away* switch is manually set on before the *Armed* switch is automatically set on.

`alarm_delay` is the delay in seconds after the *Tripped* switch is set on before the *Alarming* switch is automatically set on.

### Integration

The platform provides one accessory with the following switch services:

* *Away*: This can be manually turned on/off via the Home app or the alarm control panel web UI as you enter or leave the home.
* *Armed*: This is automatically managed by the plugin: It is turned on after `arm_delay` seconds subsequent to the *Away* 
switch being turned on and it is immediately turned off when the *Away* switch is turned off. Note that the accessory
logic prevents this being set on or off manually.
* *Tripped*: The state can be set manually via the Home app but it is not the intended usage (apart from testing).
HomeKit automation should be configured to turn this on when entry is detected 
(e.g. via an entry detection accessory). Note that the accessory logic ensures that setting the on state 
ONLY takes effect if the *Armed* switch is on. 
* *Alarming*: This is automatically managed by the plugin: It is turned on after `alarm_delay` seconds subsequent to the *Tripped* 
switch being turned on and it is immediately turned off when the *Away* switch is turned off. HomeKit automation should be
configured so that an alert is sent (e.g. via an SMS notification accessory) when this is turned on. Note that the accessory
logic prevents this being set on or off manually. 

### Usage
 
Open the following URL in your mobile browser: [http://yourHomebridgeServerIp:web_ui_port](http://yourHomebridgeServerIp:web_ui_port)

When the Home/Away button is toggled to away, the *Away* switch will be turned on. An audible alert will occur
for the `arm_delay` time after which point the *Armed* switch will be turned on and the audible alert will stop.

If the *Tripped* switch is turned on, an audible alert will occur until either:

* the Home/Away button is toggled to home causing the *Away* switch to be turned off.
* the `alarm_delay` period expires causing the *Alarming* switch to be turned off.

If the *Alarming* switch is turned on, an audible alert will occur until:

* the Home/Away button is toggled to home causing the *Away* switch to be turned off.

##### HTTP REST API

The plugin provides a simple HTTP REST API which is used by the web UI.

The current state of each switch can be queried by performing the following GET request:

`http://yourHomebridgeServerIp:web_ui_port/api/state`

This will return a response with content type `application/json` with the body content in the form:

    {
        "away": <true|false>,
        "armed": <true|false>,
        "tripped": <true|false>,
        "alarming": <true|false>
    }

The state can be updated by performing the following POST request:

`http://yourHomebridgeServerIp:web_ui_port/api/state`

with the body content in the form (only the *away* switch state can be managed):

    {
        "away": <true|false>
    }
    
This will return a response with content type `application/json` with the body content in the form:

    {
        "away": <true|false>,
        "armed": <true|false>,
        "tripped": <true|false>,
        "alarming": <true|false>
    }
