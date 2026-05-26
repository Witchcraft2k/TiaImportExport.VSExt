using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHwConfigInfo
{
	[JsonProperty("projectName")]
	public string ProjectName { get; set; } = "";

	[JsonProperty("devices")]
	public List<TiaHwDeviceInfo> Devices { get; set; } = new List<TiaHwDeviceInfo>();

	[JsonProperty("subnets")]
	public List<TiaSubnetInfo> Subnets { get; set; } = new List<TiaSubnetInfo>();
}
