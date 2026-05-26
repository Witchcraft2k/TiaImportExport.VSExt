using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaSubnetIoSystemInfo
{
	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("number")]
	public int Number { get; set; }

	[JsonProperty("ioControllerDeviceName")]
	public string? IoControllerDeviceName { get; set; }

	[JsonProperty("connectedIoDevices")]
	public List<TiaConnectedIoDeviceInfo> ConnectedIoDevices { get; set; } = new List<TiaConnectedIoDeviceInfo>();
}
