using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaNetworkNodeInfo
{
	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("ipAddress")]
	public string? IpAddress { get; set; }

	[JsonProperty("subnetMask")]
	public string? SubnetMask { get; set; }

	[JsonProperty("routerAddress")]
	public string? RouterAddress { get; set; }

	[JsonProperty("subnetName")]
	public string? SubnetName { get; set; }
}
