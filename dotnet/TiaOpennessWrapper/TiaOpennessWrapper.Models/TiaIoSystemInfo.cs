using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaIoSystemInfo
{
	[JsonProperty("ioSystemName")]
	public string IoSystemName { get; set; } = "";

	[JsonProperty("ioSystemNumber")]
	public int IoSystemNumber { get; set; }

	[JsonProperty("pnDeviceNumber")]
	public int? PnDeviceNumber { get; set; }

	[JsonProperty("ioControllerName")]
	public string? IoControllerName { get; set; }

	[JsonProperty("ioControllerDeviceName")]
	public string? IoControllerDeviceName { get; set; }

	[JsonProperty("isIoController")]
	public bool IsIoController { get; set; }

	[JsonProperty("isIoDevice")]
	public bool IsIoDevice { get; set; }

	[JsonProperty("pnDeviceName")]
	public string? PnDeviceName { get; set; }

	[JsonProperty("updateTime")]
	public string? UpdateTime { get; set; }

	[JsonProperty("watchdogTime")]
	public string? WatchdogTime { get; set; }
}
