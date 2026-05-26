using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaUdtGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("udts")]
	public List<TiaUdtInfo> Udts { get; set; } = new List<TiaUdtInfo>();

	[JsonProperty("subGroups")]
	public List<TiaUdtGroupInfo> SubGroups { get; set; } = new List<TiaUdtGroupInfo>();
}
