using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaConnectedIoDeviceInfo
{
	[JsonProperty("deviceName")]
	public string DeviceName { get; set; } = "";

	[JsonProperty("pnDeviceNumber")]
	public int PnDeviceNumber { get; set; }

	[JsonProperty("pnDeviceName")]
	public string? PnDeviceName { get; set; }
}
