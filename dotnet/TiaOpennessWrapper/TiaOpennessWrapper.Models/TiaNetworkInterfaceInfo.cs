using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaNetworkInterfaceInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("interfaceType")]
	public string InterfaceType { get; set; } = "";

	[JsonProperty("operatingMode")]
	public string OperatingMode { get; set; } = "";

	[JsonProperty("ioSystemInfo")]
	public TiaIoSystemInfo? IoSystemInfo { get; set; }

	[JsonProperty("nodes")]
	public List<TiaNetworkNodeInfo> Nodes { get; set; } = new List<TiaNetworkNodeInfo>();
}
