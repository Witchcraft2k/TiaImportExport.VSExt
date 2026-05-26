using System.Collections.Generic;
using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaProjectInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("path")]
	public string Path { get; set; } = "";

	[JsonProperty("version")]
	public string? Version { get; set; }

	[JsonProperty("author")]
	public string? Author { get; set; }

	[JsonProperty("devices")]
	public List<TiaDeviceInfo> Devices { get; set; } = new List<TiaDeviceInfo>();

	[JsonProperty("library")]
	public TiaLibraryFolderInfo? Library { get; set; }

	[JsonProperty("libraryTypes")]
	public TiaLibraryTypeFolderInfo? LibraryTypes { get; set; }
}
