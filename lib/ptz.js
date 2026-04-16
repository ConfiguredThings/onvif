/**
 * @namespace cam
 * @description PTZ section for Cam class
 * @author Andrew D.Laptev <a.d.laptev@gmail.com>
 * @licence MIT
 */
module.exports = function(Cam) {

	const linerase = require('./utils').linerase;

	/**
	 * Receive cam presets
	 * @param {object} [options]
	 * @param {string} [options.profileToken]
	 * @param [callback]
	 */
	Cam.prototype.getPresets = function(options, callback) {
		if (callback === undefined) { callback = options; options = {};	}
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetPresets xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'</GetPresets>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			if (!err) {
				this.presets = {};
				var presets = linerase(data).getPresetsResponse.preset;
				if (typeof presets !== 'undefined') {
					if (!Array.isArray(presets)) {
						presets = [presets];
					}
					presets.forEach(function(preset) {
						this.presets[preset.$.token] = preset;
					}.bind(this));
				}
			}
			if (callback) {
				callback.call(this, err, this.presets, xml);
			}
		}.bind(this));
	};

	/**
	 * /PTZ/ Go to preset
	 * @param {object} options
	 * @param {string} [options.profileToken]
	 * @param {string} options.preset PresetName from {@link Cam#presets} property
	 * @param {string} options.speed
	 * @param {function} callback
	 */
	Cam.prototype.gotoPreset = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GotoPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				'<PresetToken>' + options.preset + '</PresetToken>' +
				(options.speed ? '<Speed>' + this._panTiltZoomVectors(options.speed) + '</Speed>' : '') +
			'</GotoPreset>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};
	/**
	 * /PTZ/ Set preset
	 * @param {object} options
	 * @param {string} [options.profileToken]
	 * @param {string} options.presetName
	 * @param {string} [options.presetToken]
	 * @param {function} callback
	 */
	Cam.prototype.setPreset = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<SetPreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'<PresetName>' + options.presetName + '</PresetName>' +
			(options.presetToken ? '<PresetToken>' + options.presetToken + '</PresetToken>' : '') +
			'</SetPreset>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};
	/**
	 * /PTZ/ Remove preset
	 * @param {object} options
	 * @param {string} [options.profileToken]
	 * @param {string} options.presetToken
	 * @param {function} callback
	 */
	Cam.prototype.removePreset = function(options,callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<RemovePreset xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'<PresetToken>' + options.presetToken + '</PresetToken>' +
			'</RemovePreset>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * /PTZ/ Go to home position
	 * @param {object} options
	 * @param {string} [options.profileToken]
	 * @param {object} [options.speed] If the speed argument is omitted, the default speed set by the PTZConfiguration will be used.
	 * @param {number} [options.speed.x] Pan speed, float within 0 to 1
	 * @param {number} [options.speed.y] Tilt speed, float within 0 to 1
	 * @param {number} [options.speed.zoom] Zoom speed, float within 0 to 1
	 * @param {function} callback
	 */
	Cam.prototype.gotoHomePosition = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GotoHomePosition xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				(options.speed ? '<Speed>' + this._panTiltZoomVectors(options.speed) + '</Speed>' : '') +
			'</GotoHomePosition>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * /PTZ/ Set home position
	 * @param {object} options
	 * @param {string} [options.profileToken]
	 * @param {function} callback
	 */
	Cam.prototype.setHomePosition = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<SetHomePosition xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'</SetHomePosition>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * @typedef {object} Cam~PTZStatus
	 * @property {object} position
	 * @property {number} position.x
	 * @property {number} position.y
	 * @property {number} position.zoom
	 * @property {string} moveStatus
	 * @property {?Error} error
	 * @property {Date} utcTime
	 */

	/**
	 * @callback Cam~GetPTZStatusCallback
	 * @property {?Error} error
	 * @property {Cam~PTZStatus} status
	 */

	/**
	 * /PTZ/ Receive cam status
	 * @param {Object} [options]
	 * @param {string} [options.profileToken={@link Cam#activeSource.profileToken}]
	 * @param {Cam~GetPTZStatusCallback} callback
	 */
	Cam.prototype.getStatus = function(options, callback) {
		if (callback === undefined) { callback = options; options = {};	}
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetStatus xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'</GetStatus>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let status = {};
			if (!err) {
				status = linerase(data).getStatusResponse.PTZStatus;
			}
			callback.call(this, err, err ? null : status, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ Returns the available PTZ nodes.
	 * Use this function to get maximum number of presets, ranges of admitted values for x, y, zoom, iris, focus
	 * @param {Function} callback
	 */
	Cam.prototype.getNodes = function(callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetNodes xmlns="http://www.onvif.org/ver20/ptz/wsdl" />' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let nodes = [];
			if (!err) {
				nodes = data[0]['getNodesResponse'][0].PTZNode.map(function(node) {
					return linerase(node);
				});
			}
			callback.call(this, err, err ? null : nodes, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ Get a specific node from a Token
	 * Use this function to get maximum number of presets, ranges of admitted values for x, y, zoom, iris, focus
	 * @param {Function} callback
	 */
	Cam.prototype.getNode = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetNode xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<NodeToken>' + options.nodeToken + '</NodeToken>' +
            '</GetNode>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let node = {};
			if (!err) {
				node = linerase(data[0]['getNodeResponse'][0].PTZNode);
			}
			callback.call(this, err, err ? null : node, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ Get PTZ Configurations
	 * @param {Function} callback
	 */
	Cam.prototype.getConfigurations = function(callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetConfigurations xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'</GetConfigurations>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let configurations = [];
			if (!err) {
				configurations = data[0]['getConfigurationsResponse'][0].PTZConfiguration.map(function(configuration) {
					return linerase(configuration);
				});
			}
			callback.call(this, err, err ? null : configurations, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ Get a specfic PTZ Configuration
	 * @param {Function} callback
	 */
	Cam.prototype.getConfiguration = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetConfiguration xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<PTZConfigurationToken>' + options.configurationToken + '</PTZConfigurationToken>' +
            '</GetConfiguration>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let configuration = {};
			if (!err) {
				configuration = linerase(data[0]['getConfigurationResponse'][0].PTZConfiguration);
			}
			callback.call(this, err, err ? null : configuration, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ Get PTZ Configurations comaptible woth a profile
	 * @param {Function} callback
	 */
	Cam.prototype.getCompatibleConfigurations = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetCompatibleConfigurations xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + options.profileToken + '</ProfileToken>' +
            '</GetCompatibleConfigurations>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let configurations = [];
			if (!err) {
				configurations = data[0]['getCompatibleConfigurationsResponse'][0].PTZConfiguration.map(function(configuration) {
					return linerase(configuration);
				});
			}
			callback.call(this, err, err ? null : configurations, xml);
		}.bind(this));
	};

	
	

	/**
	 * /PTZ/ Get options for the PTZ configuration
	 * @param {string} configurationToken
	 * @param {Function} callback
	 */
	Cam.prototype.getConfigurationOptions = function(options, callback) {
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<GetConfigurationOptions xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ConfigurationToken>' + options.configurationToken + '</ConfigurationToken>' +
			'</GetConfigurationOptions>' +
			this._envelopeFooter()
		}, function(err, data, xml) {
			let configOptions = {};
			if (!err) {
				configOptions = linerase(data[0]['getConfigurationOptionsResponse'][0]['PTZConfigurationOptions'][0]);
			}
			callback.call(this, err, err ? null : configOptions, xml);
		}.bind(this));
	};

	/**
	 * /PTZ/ relative move
	 * @param {object} options
	 * @param {string} [options.profileToken=Cam#activeSource.profileToken]
	 * @param {number} [options.x=0] Pan, float. Min and Max values defined by the Space used (often -1 to +1)
	 * @param {number} [options.y=0] Tilt, float. Min and Max values defined by the Space used (often -1 to +1)
	 * @param {number} [options.xyspace] Optional geometry space to be used when not using the default space
	 * @param {number} [options.zoom=0] Zoom, float. Min and Max values defined by the Space used (often -1 to +1)
	 * @param {number} [options.zoomspace] Optional geometry space to be used when not using the default space
	 * @param {object} [options.speed] If the speed argument is omitted, the default speed set by the PTZConfiguration will be used.
	 * @param {number} [options.speed.x] Pan speed, float. Min and Max values defined by the Space used (often -0 to +1)
	 * @param {number} [options.speed.y] Tilt speed, float. Min and Max values defined by the Space used (often -0 to +1)
	 * @param {number} [options.speed.zoom] Zoom speed, float. Min and Max values defined by the Space used (often -0 to +1)
	 * @param {Cam~RequestCallback} [callback]
	 */
	Cam.prototype.relativeMove = function(options, callback) {
		callback = callback ? callback.bind(this) : function() {};
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<RelativeMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				'<Translation>' +
					this._panTiltZoomVectors(options) +
				'</Translation>' +
				(options.speed ? '<Speed>' + this._panTiltZoomVectors(options.speed) + '</Speed>' : '') +
			'</RelativeMove>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * /PTZ/ absolute move
	 * @param {object} options
	 * @param {string} [options.profileToken=Cam#activeSource.profileToken]
	 * @param {number} [options.x] Pan, float within -1 to 1
	 * @param {number} [options.y] Tilt, float within -1 to 1
	 * @param {number} [options.zoom] Zoom, float within 0 to 1
	 * @param {object} [options.speed] If the speed argument is omitted, the default speed set by the PTZConfiguration will be used.
	 * @param {number} [options.speed.x] Pan speed, float within 0 to 1
	 * @param {number} [options.speed.y] Tilt speed, float within 0 to 1
	 * @param {number} [options.speed.zoom] Zoom speed, float within 0 to 1
	 * @param {Cam~RequestCallback} [callback]
	 */
	Cam.prototype.absoluteMove = function(options, callback) {
		callback = callback ? callback.bind(this) : function() {};

		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<AbsoluteMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				'<Position>' +
					this._panTiltZoomVectors(options) +
				'</Position>' +
				(options.speed ? '<Speed>' + this._panTiltZoomVectors(options.speed) + '</Speed>' : '') +
			'</AbsoluteMove>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * /PTZ/ Operation for continuous Pan/Tilt and Zoom movements
	 * @param options
	 * @param {string} [options.profileToken=Cam#activeSource.profileToken]
	 * @param {number} [options.x=0] pan velocity, float within -1 to 1
	 * @param {number} [options.y=0] tilt velocity, float within -1 to 1
	 * @param {number} [options.zoom=0] zoom velocity, float within -1 to 1
	 * @param {boolean} [options.onlySendPanTilt] Only send the Pan and Tilt values in the ONVIF XML. Zoom not sent in the XML
	 * @param {boolean} [options.onlySendZoom] Only send the Zoom values in the ONVIF XML. PanTilt not sent in the XML
	 * Somy cameras do not accept X and Y and Zoom all at the same time
	 * @param {number} [options.timeout=Infinity] timeout in milliseconds
	 * @param {Cam~RequestCallback} callback
	 */
	Cam.prototype.continuousMove = function(options, callback) {
		callback = callback ? callback.bind(this) : function() { };

		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<ContinuousMove xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				'<Velocity>' +
					this._panTiltZoomVectors(options) +
				'</Velocity>' +
				(options.timeout ? '<Timeout>PT' + (options.timeout / 1000) + 'S</Timeout>' : '') +
				(options.xsd_timeout ? '<Timeout>' + options.xsd_timeout + '</Timeout>' : '') +
			'</ContinuousMove>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * Stop ongoing pan, tilt and zoom movements of absolute relative and continuous type
	 * @param {object} [options]
	 * @param {string} [options.profileToken]
	 * @param {boolean|string} [options.panTilt]
	 * @param {boolean|string} [options.zoom]
	 * @param {Cam~RequestCallback} [callback]
	 */
	Cam.prototype.stop = function(options, callback) {
		if (callback === undefined) {
			switch (typeof options) {
				case 'object': callback = function() {}; break;
				case 'function': callback = options; options = {}; break;
				default: callback = function() {}; options = {};
			}
		}
		this._request({
			service: 'ptz'
			, body: this._envelopeHeader() +
			'<Stop xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
				'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
				(options.panTilt ? '<PanTilt>' + options.panTilt + '</PanTilt>' : '') +
				(options.zoom ? '<Zoom>' + options.zoom + '</Zoom>' : '') +
			'</Stop>' +
			this._envelopeFooter()
		}, callback.bind(this));
	};

	/**
	 * Create ONVIF soap vector
	 * @param [ptz.x]
	 * @param [ptz.y]
	 * @param [ptz.xyspace]
	 * @param [ptz.zoom]
	 * @param [ptz.zoomspace]
	 * @return {string}
	 * @private
	 */
	Cam.prototype._panTiltZoomVectors = function(ptz) {
		// add leading ' ' (space) to xyspace and zspace
		const xyspace = (ptz.xyspace !== undefined ? ' space="' + ptz.xyspace + '"' : '');
		const zoomspace = (ptz.zoomspace !== undefined ? ' space="' + ptz.zoomspace + '"' : '');

		return ptz
			?
			(ptz.x !== undefined && ptz.y !== undefined
				? '<PanTilt x="' + ptz.x + '" y="' + ptz.y + '"' + xyspace + ' xmlns="http://www.onvif.org/ver10/schema"/>'
				: '') +
			(ptz.zoom !== undefined
				? '<Zoom x="' + ptz.zoom + '"' + zoomspace + ' xmlns="http://www.onvif.org/ver10/schema"/>'
				: '')
			: '';
	};

	/**
	 * PTZ Service Send Auxiliary Command
	 * @param {object} options
	 * @param {string} [options.profileToken=Cam#activeSource.profileToken]
	 * @param {string} [options.data]
	 * @param {function} callback
	 */

	Cam.prototype.ptzSendAuxiliaryCommand = function(options, callback) {
		let body = this._envelopeHeader() +
			'<SendAuxiliaryCommand xmlns="http://www.onvif.org/ver20/ptz/wsdl">' +
			'<ProfileToken>' + (options.profileToken || this.activeSource.profileToken) + '</ProfileToken>' +
			'<AuxiliaryData>' + options.data + '</AuxiliaryData>' +
			'</SendAuxiliaryCommand>' +
			this._envelopeFooter();
		this._request({
			service: 'ptz',
			body: body,
		}, function(err, data, xml) {
			if (callback) {
				callback.call(this, err, data, xml);
			}
		}.bind(this));
	};

};
