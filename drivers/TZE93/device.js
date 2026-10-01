'use strict';

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

class TZE93 extends ZwaveDevice {

	async onNodeInit() {

		// Display debugging information in the console
		this.enableDebug();
		this.printNode();

		// 1. ONOFF CAPABILITY REGISTRATION
		this.registerCapability('onoff', 'BASIC', {
			getOpts: {
				getOnStart: true,
			},
			get: 'BASIC_GET',
			set: 'BASIC_SET',
			setParser: value => {
				return {
					'Value': value ? 255 : 0
				};
			},
			report: 'BASIC_REPORT',
			reportParser: report => {
				if (report && report.hasOwnProperty('Value')) {
					const isTurnedOn = report['Value'] > 0;
					
					// Prevention of crash: Execute logging and synchronization logic asynchronously outside the main reportParser thread
					process.nextTick(async () => {
						this.log('[TZE93] Physical status of the thermostat has changed. Turned on?:', isTurnedOn);
						
						if (isTurnedOn) {
							try {
								// Safe retrieval of the value from Homey memory
								const mobileSetpoint = this.getCapabilityValue('target_temperature');
								this.log('[TZE93] Turning on detected. Value in the mobile app is:', mobileSetpoint);

								if (mobileSetpoint && this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT) {
									
									// Send command to hardware with rounding handling
									await this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET({
										'Level': { 'Setpoint Type': 'Heating 1' },
										'Level2': { 'Size': 2, 'Scale': 0, 'Precision': 1 },
										'Value': Buffer.from([0, Math.round(mobileSetpoint * 10)])
									});
									this.log('[TZE93] Z-Wave command for temperature synchronization sent successfully.');
								}
							} catch (err) {
								this.error('[TZE93] Failed to retrieve or write temperature after turn-on:', err);
							}
						}
					});

					return isTurnedOn;
				}
				return 0; 
			}
		});

		this.registerCapability('thermostat_mode', 'THERMOSTAT_MODE');

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
			},
		});

		this.registerCapability('target_temperature', 'THERMOSTAT_SETPOINT', {
			getOpts: {
				getOnStart: true,
			},
		});
	}

}

module.exports = TZE93;
