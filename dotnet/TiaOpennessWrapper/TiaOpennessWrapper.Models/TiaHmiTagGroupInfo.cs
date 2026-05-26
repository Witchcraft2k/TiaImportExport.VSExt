using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiTagGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("parentId")]
	public string? ParentId { get; set; }

	[JsonProperty("tags")]
	public List<TiaHmiTagInfo> Tags { get; set; } = new List<TiaHmiTagInfo>();

	[JsonProperty("subGroups")]
	public List<TiaHmiTagGroupInfo> SubGroups { get; set; } = new List<TiaHmiTagGroupInfo>();
}
