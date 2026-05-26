using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiScreenGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("screens")]
	public List<TiaHmiScreenInfo> Screens { get; set; } = new List<TiaHmiScreenInfo>();

	[JsonProperty("subGroups")]
	public List<TiaHmiScreenGroupInfo> SubGroups { get; set; } = new List<TiaHmiScreenGroupInfo>();
}
