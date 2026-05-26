using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHwDeviceInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("typeIdentifier")]
	public string TypeIdentifier { get; set; } = "";

	[JsonProperty("deviceType")]
	public string DeviceType { get; set; } = "";

	[JsonProperty("orderNumber")]
	public string? OrderNumber { get; set; }

	[JsonProperty("firmwareVersion")]
	public string? FirmwareVersion { get; set; }

	[JsonProperty("comment")]
	public string? Comment { get; set; }

	[JsonProperty("racks")]
	public List<TiaRackInfo> Racks { get; set; } = new List<TiaRackInfo>();

	[JsonProperty("networkInterfaces")]
	public List<TiaNetworkInterfaceInfo> NetworkInterfaces { get; set; } = new List<TiaNetworkInterfaceInfo>();
}
