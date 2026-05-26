using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaTagTableGroupInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("tagTables")]
	public List<TiaTagTableInfo> TagTables { get; set; } = new List<TiaTagTableInfo>();

	[JsonProperty("subGroups")]
	public List<TiaTagTableGroupInfo> SubGroups { get; set; } = new List<TiaTagTableGroupInfo>();
}
