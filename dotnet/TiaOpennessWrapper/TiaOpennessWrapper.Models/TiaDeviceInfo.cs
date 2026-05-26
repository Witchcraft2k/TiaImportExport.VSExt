using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaDeviceInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("displayName")]
	public string DisplayName { get; set; } = "";

	[JsonProperty("type")]
	public string Type { get; set; } = "";

	[JsonProperty("orderNumber")]
	public string? OrderNumber { get; set; }

	[JsonProperty("firmwareVersion")]
	public string? FirmwareVersion { get; set; }

	[JsonProperty("ipAddress")]
	public string? IpAddress { get; set; }

	[JsonProperty("plcSoftware")]
	public List<TiaPlcSoftwareInfo> PlcSoftware { get; set; } = new List<TiaPlcSoftwareInfo>();

	[JsonProperty("hmiSoftware")]
	public List<TiaHmiSoftwareInfo> HmiSoftware { get; set; } = new List<TiaHmiSoftwareInfo>();
}
