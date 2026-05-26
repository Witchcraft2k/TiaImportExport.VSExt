using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiSoftwareInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("type")]
	public string Type { get; set; } = "Classic";

	[JsonProperty("screenGroups")]
	public List<TiaHmiScreenGroupInfo> ScreenGroups { get; set; } = new List<TiaHmiScreenGroupInfo>();

	[JsonProperty("tagGroups")]
	public List<TiaHmiTagGroupInfo> TagGroups { get; set; } = new List<TiaHmiTagGroupInfo>();

	[JsonProperty("connections")]
	public List<TiaHmiConnectionInfo> Connections { get; set; } = new List<TiaHmiConnectionInfo>();

	[JsonProperty("screens")]
	public List<TiaHmiScreenInfo> Screens { get; set; } = new List<TiaHmiScreenInfo>();

	[JsonProperty("tags")]
	public List<TiaHmiTagInfo> Tags { get; set; } = new List<TiaHmiTagInfo>();
}
