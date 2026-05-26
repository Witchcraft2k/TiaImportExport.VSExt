using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaSubnetInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("subnetType")]
	public string SubnetType { get; set; } = "";

	[JsonProperty("connectedDevices")]
	public List<string> ConnectedDevices { get; set; } = new List<string>();

	[JsonProperty("ioSystems")]
	public List<TiaSubnetIoSystemInfo> IoSystems { get; set; } = new List<TiaSubnetIoSystemInfo>();
}
