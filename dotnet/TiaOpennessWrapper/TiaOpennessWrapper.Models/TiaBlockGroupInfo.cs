using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaBlockGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("blocks")]
	public List<TiaBlockInfo> Blocks { get; set; } = new List<TiaBlockInfo>();

	[JsonProperty("subGroups")]
	public List<TiaBlockGroupInfo> SubGroups { get; set; } = new List<TiaBlockGroupInfo>();
}
