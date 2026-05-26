using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaTagTableInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("tagCount")]
	public int TagCount { get; set; }

	[JsonProperty("tags")]
	public List<TiaTagInfo> Tags { get; set; } = new List<TiaTagInfo>();
}
