using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Siemens.Engineering;
using Siemens.Engineering.HW;
using Siemens.Engineering.Multiuser;
using Siemens.Engineering.SW;
using TiaOpennessWrapper.Models;
using TiaOpennessWrapper.Services.Import;

namespace TiaOpennessWrapper.Services;

public class TiaConnectionManager : IDeviceLocator
{
	private sealed class WindowHandleWrapper : IWin32Window
	{
		public IntPtr Handle { get; }

		public WindowHandleWrapper(IntPtr handle)
		{
			Handle = handle;
		}
	}

	private sealed class ProjectSelectionEntry
	{
		public ProjectBase Project { get; }

		public TiaProjectInfo Info { get; }

		public ProjectSelectionEntry(ProjectBase project, TiaProjectInfo info)
		{
			Project = project;
			Info = info;
		}
	}

	private TiaPortal? _tiaPortal;

	private ProjectBase? _currentProject;

	private bool _ownsTiaPortal;

	private List<TiaProjectInfo> _projects = new List<TiaProjectInfo>();

	private readonly Dictionary<string, ProjectSelectionEntry> _projectEntries = new Dictionary<string, ProjectSelectionEntry>(StringComparer.OrdinalIgnoreCase);

	private TiaProjectInfo? _selectedProject;

	private readonly ProjectStructureBuilder _structureBuilder;

	public TiaPortal? TiaPortal => _tiaPortal;

	public ProjectBase? CurrentProject => _currentProject;

	public bool OwnsTiaPortal => _ownsTiaPortal;

	public Action? OnProjectSelected { get; set; }

	public TiaConnectionManager(ProjectStructureBuilder structureBuilder)
	{
		_structureBuilder = structureBuilder ?? throw new ArgumentNullException("structureBuilder");
	}

	public async Task<object> ConnectAsync()
	{
		return await Task.Run(delegate
		{
			try
			{
				IList<TiaPortalProcess> processes = TiaPortal.GetProcesses();
				if (processes.Count > 0)
				{
					return AttachToRunningPortal(processes);
				}
				return OpenProjectFromFile();
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = "Failed to connect to TIA Portal: " + ex.Message,
					details = ex.ToString()
				};
			}
		});
	}

	public async Task DisconnectAsync()
	{
		await Task.Run(delegate
		{
			try
			{
				if (_currentProject != null)
				{
					_currentProject = null;
				}
				if (_tiaPortal != null)
				{
					if (_ownsTiaPortal)
					{
						_tiaPortal.Dispose();
					}
					_tiaPortal = null;
				}
				_ownsTiaPortal = false;
			}
			catch (Exception)
			{
			}
			_selectedProject = null;
			_projects.Clear();
			_projectEntries.Clear();
		});
	}

	public async Task DetachAsync()
	{
		await Task.Run(delegate
		{
			try
			{
				_currentProject = null;
				_tiaPortal = null;
				_ownsTiaPortal = false;
			}
			catch (Exception)
			{
			}
			_selectedProject = null;
			_projects.Clear();
			_projectEntries.Clear();
		});
	}

	public async Task<object> PingAsync()
	{
		return await Task.Run((Func<object>)delegate
		{
			try
			{
				if (_tiaPortal == null)
				{
					return new
					{
						success = false,
						error = "No TIA Portal instance"
					};
				}
				int count = _tiaPortal.Projects.Count;
				try
				{
					count += _tiaPortal.LocalSessions.Count;
				}
				catch
				{
				}
				return new
				{
					success = true,
					projectCount = count
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = "TIA Portal connection lost: " + ex.Message
				};
			}
		});
	}

	public async Task<object> GetProjectsAsync()
	{
		return await Task.Run((Func<object>)delegate
		{
			if (_tiaPortal != null)
			{
				try
				{
					RefreshProjectCache();
				}
				catch (Exception ex)
				{
					return new
					{
						success = false,
						error = ex.Message
					};
				}
			}
			return new
			{
				success = true,
				projects = _projects
			};
		});
	}

	public async Task<object> OpenProjectAsync(string projectPath)
	{
		return await Task.Run(() => OpenProjectFromPath(projectPath, "Headless"));
	}

	public async Task<object> SelectProjectAsync(string projectName)
	{
		return await Task.Run((Func<object>)delegate
		{
			if (_tiaPortal == null)
			{
				return new
				{
					success = false,
					error = "Not connected to TIA Portal"
				};
			}
			try
			{
				RefreshProjectCache();
				string error;
				ProjectSelectionEntry projectSelectionEntry = ResolveProjectSelection(projectName, out error);
				if (projectSelectionEntry == null)
				{
					return new
					{
						success = false,
						error = error
					};
				}
				_currentProject = projectSelectionEntry.Project;
				OnProjectSelected?.Invoke();
				TiaProjectInfo tiaProjectInfo = _structureBuilder.BuildProjectStructure(_currentProject, projectSelectionEntry.Info.Id);
				_selectedProject = tiaProjectInfo;
				return new
				{
					success = true,
					project = tiaProjectInfo
				};
			}
			catch (Exception ex)
			{
				return new
				{
					success = false,
					error = ex.Message
				};
			}
		});
	}

	public async Task<object> GetProjectStructureAsync(string projectName)
	{
		return await SelectProjectAsync(projectName);
	}

	public Device? FindDevice(string deviceId)
	{
		if (_currentProject == null)
		{
			return null;
		}
		foreach (Device device in ((ProjectBase)_currentProject).Devices)
		{
			if (DeviceItemHelper.GetDeviceDisplayName(device) == deviceId)
			{
				return device;
			}
		}
		try
		{
			DeviceSystemGroup ungroupedDevicesGroup = ((ProjectBase)_currentProject).UngroupedDevicesGroup;
			if (((ungroupedDevicesGroup != null) ? ((DeviceGroup)ungroupedDevicesGroup).Devices : null) != null)
			{
				foreach (Device device2 in ((DeviceGroup)((ProjectBase)_currentProject).UngroupedDevicesGroup).Devices)
				{
					if (DeviceItemHelper.GetDeviceDisplayName(device2) == deviceId)
					{
						return device2;
					}
				}
			}
		}
		catch
		{
		}
		return ((IEnumerable<Device>)((ProjectBase)_currentProject).Devices).FirstOrDefault((Device d) => ((HardwareObject)d).Name == deviceId);
	}

	public PlcSoftware? GetPlcSoftware(Device device)
	{
		foreach (DeviceItem deviceItem in ((HardwareObject)device).DeviceItems)
		{
			PlcSoftware plcSoftwareFromItem = _structureBuilder.GetPlcSoftwareFromItem(deviceItem);
			if (plcSoftwareFromItem != null)
			{
				return plcSoftwareFromItem;
			}
		}
		return null;
	}

	private object AttachToRunningPortal(IList<TiaPortalProcess> processes)
	{
		try
		{
			TiaPortalProcess val = processes[0];
			_tiaPortal = val.Attach();
			_ownsTiaPortal = false;
			if (_tiaPortal == null)
			{
				return new
				{
					success = false,
					error = "Failed to attach to TIA Portal process"
				};
			}
			RefreshProjectCache();
			if (_projects.Count == 0)
			{
				return new
				{
					success = true,
					connected = true,
					projects = _projects,
					message = "TIA Portal is running but no projects or local sessions are open. Please open a project or local session in TIA Portal.",
					requiresProjectSelection = false
				};
			}
			return new
			{
				success = true,
				connected = true,
				projects = _projects,
				message = $"Connected to TIA Portal. Found {_projects.Count} open project(s).",
				requiresProjectSelection = (_projects.Count > 1)
			};
		}
		catch (Exception ex)
		{
			return new
			{
				success = false,
				error = "Failed to attach to TIA Portal: " + ex.Message
			};
		}
	}

	private object OpenProjectFromFile()
	{
		//IL_008c: Unknown result type (might be due to invalid IL or missing references)
		//IL_0096: Expected O, but got Unknown
		try
		{
			string projectPath = null;
			string dialogForegroundMode = "Unknown";
			Thread thread = new Thread((ThreadStart)delegate
			{
				using OpenFileDialog openFileDialog = new OpenFileDialog();
				openFileDialog.Title = "Select TIA Portal Project";
				openFileDialog.Filter = BuildProjectFileFilter();
				openFileDialog.FilterIndex = 1;
				openFileDialog.RestoreDirectory = true;
				openFileDialog.CheckFileExists = true;
				IntPtr foregroundWindow = GetForegroundWindow();
				DialogResult dialogResult;
				if (foregroundWindow != IntPtr.Zero)
				{
					dialogForegroundMode = "OwnerHandle";
					dialogResult = openFileDialog.ShowDialog(new WindowHandleWrapper(foregroundWindow));
				}
				else
				{
					dialogForegroundMode = "TopMostFallback";
					using Form form = CreateTopMostOwnerForm();
					form.Show();
					form.Activate();
					dialogResult = openFileDialog.ShowDialog(form);
				}
				if (dialogResult == DialogResult.OK)
				{
					projectPath = openFileDialog.FileName;
				}
			});
			thread.SetApartmentState(ApartmentState.STA);
			thread.Start();
			thread.Join();
			if (string.IsNullOrEmpty(projectPath))
			{
				return new
				{
					success = false,
					error = "No project file selected",
					cancelled = true
				};
			}
			if (!File.Exists(projectPath))
			{
				return new
				{
					success = false,
					error = "Project file not found: " + projectPath
				};
			}
			return OpenProjectFromPath(projectPath, dialogForegroundMode);
		}
		catch (Exception ex)
		{
			return new
			{
				success = false,
				error = "Failed to open project: " + ex.Message,
				details = ex.ToString()
			};
		}
	}

	private object OpenProjectFromPath(string projectPath, string dialogForegroundMode)
	{
		try
		{
			if (string.IsNullOrWhiteSpace(projectPath))
			{
				return new
				{
					success = false,
					error = "Project file path is required"
				};
			}
			if (!File.Exists(projectPath))
			{
				return new
				{
					success = false,
					error = "Project file not found: " + projectPath
				};
			}
			if (_tiaPortal == null)
			{
				_tiaPortal = new TiaPortal((TiaPortalMode)1);
				_ownsTiaPortal = true;
			}
			FileInfo fileInfo = new FileInfo(projectPath);
			if (IsLocalSessionFile(fileInfo))
			{
				LocalSession localSession = _tiaPortal.LocalSessions.Open(fileInfo);
				_currentProject = localSession.Project;
			}
			else
			{
				_currentProject = _tiaPortal.Projects.Open(fileInfo);
			}
			if (_currentProject == null)
			{
				return new
				{
					success = false,
					error = "Failed to open project"
				};
			}
			OnProjectSelected?.Invoke();
			_projectEntries.Clear();
			string text = CreateProjectSelector(_currentProject, projectPath);
			TiaProjectInfo tiaProjectInfo = CreateProjectInfo(_currentProject, text, projectPath);
			_projectEntries[text] = new ProjectSelectionEntry(_currentProject, tiaProjectInfo);
			_projects = new List<TiaProjectInfo> { tiaProjectInfo };
			return new
			{
				success = true,
				connected = true,
				project = tiaProjectInfo,
				projects = _projects,
				message = "Opened project: " + _currentProject.Name,
				dialogForegroundMode = dialogForegroundMode,
				requiresProjectSelection = false,
				autoSelectedProject = _currentProject.Name
			};
		}
		catch (Exception ex)
		{
			if (_ownsTiaPortal && _tiaPortal != null)
			{
				try
				{
					_tiaPortal.Dispose();
				}
				catch
				{
				}
				_tiaPortal = null;
				_ownsTiaPortal = false;
			}
			return new
			{
				success = false,
				error = "Failed to open project: " + ex.Message,
				details = ex.ToString()
			};
		}
	}

	private void RefreshProjectCache()
	{
		_projectEntries.Clear();
		_projects = new List<TiaProjectInfo>();
		if (_tiaPortal == null)
		{
			return;
		}
		foreach (Project project in _tiaPortal.Projects)
		{
			RegisterProject(project);
		}
		try
		{
			foreach (LocalSession localSession in _tiaPortal.LocalSessions)
			{
				RegisterProject(localSession.Project);
			}
		}
		catch
		{
		}
		_projects = _projects.OrderBy((TiaProjectInfo p) => p.Name, StringComparer.OrdinalIgnoreCase).ThenBy((TiaProjectInfo p) => p.Path, StringComparer.OrdinalIgnoreCase).ToList();
	}

	private void RegisterProject(ProjectBase project, string? fallbackPath = null)
	{
		string text = CreateProjectSelector(project, fallbackPath);
		if (_projectEntries.ContainsKey(text))
		{
			return;
		}
		TiaProjectInfo tiaProjectInfo = CreateProjectInfo(project, text, fallbackPath);
		_projectEntries[text] = new ProjectSelectionEntry(project, tiaProjectInfo);
		_projects.Add(tiaProjectInfo);
	}

	private ProjectSelectionEntry? ResolveProjectSelection(string projectReference, out string error)
	{
		error = "Project '" + projectReference + "' not found";
		if (_projectEntries.TryGetValue(projectReference, out var value))
		{
			return value;
		}
		List<TiaProjectInfo> list = _projects.Where((TiaProjectInfo project) => string.Equals(project.Name, projectReference, StringComparison.OrdinalIgnoreCase)).ToList();
		if (list.Count == 1 && _projectEntries.TryGetValue(list[0].Id, out value))
		{
			return value;
		}
		if (list.Count > 1)
		{
			error = "Multiple open projects are named '" + projectReference + "'. Use the project id/path returned by tia_list_projects or the UI quick pick entry.";
		}
		return null;
	}

	private TiaProjectInfo CreateProjectInfo(ProjectBase project, string selector, string? fallbackPath = null)
	{
		return new TiaProjectInfo
		{
			Id = selector,
			Name = project.Name,
			Path = (project.Path?.FullName ?? fallbackPath ?? ""),
			Version = GetProjectVersion(project)
		};
	}

	private string CreateProjectSelector(ProjectBase project, string? fallbackPath = null)
	{
		return project.Path?.FullName ?? fallbackPath ?? project.Name;
	}

	private static bool IsLocalSessionFile(FileInfo fileInfo)
	{
		return fileInfo.Extension.StartsWith(".als", StringComparison.OrdinalIgnoreCase);
	}

	private string GetProjectVersion(ProjectBase project)
	{
		try
		{
			return TiaConnector.GetInitializedVersionString();
		}
		catch
		{
			return "Unknown";
		}
	}

	private string BuildProjectFileFilter()
	{
		string initializedVersionString = TiaConnector.GetInitializedVersionString();
		string text = initializedVersionString.Replace("V", "");
		string[] array = new string[4] { "21", "20", "19", "18" };
		List<string> list = new List<string>();
		list.Add("TIA Portal " + initializedVersionString + " Projects / Sessions (*.ap" + text + ";*.als" + text + ")|*.ap" + text + ";*.als" + text);
		string[] array2 = array;
		foreach (string text2 in array2)
		{
			if (text2 != text)
			{
				list.Add("TIA Portal V" + text2 + " Projects / Sessions (*.ap" + text2 + ";*.als" + text2 + ")|*.ap" + text2 + ";*.als" + text2);
			}
		}
		list.Add("All TIA Projects / Sessions (*.ap*;*.als*)|*.ap*;*.als*");
		return string.Join("|", list);
	}

	private static Form CreateTopMostOwnerForm()
	{
		return new Form
		{
			ShowInTaskbar = false,
			FormBorderStyle = FormBorderStyle.None,
			StartPosition = FormStartPosition.Manual,
			Location = new Point(-32000, -32000),
			Size = new Size(1, 1),
			TopMost = true
		};
	}

	[DllImport("user32.dll")]
	private static extern IntPtr GetForegroundWindow();
}
